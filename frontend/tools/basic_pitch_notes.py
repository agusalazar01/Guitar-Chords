# Genera las notas de Basic Pitch (igual que el worker de la app) para la evaluación: python3 tools/basic_pitch_notes.py audio.f32 salida.notes [...]
# Requiere: pip install onnxruntime numpy. Audio: ffmpeg -i X.mp3 -ac 1 -ar 22050 -f f32le audio.f32
import sys, time, numpy as np, onnxruntime as ort
import os; M=os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'basic-pitch-nmp.onnx')
SR=22050; HOP=256; N=43844; OLF=30; OL=OLF*HOP; STEP=N-OL; FPS=SR/HOP
sess=ort.InferenceSession(M, providers=['CPUExecutionProvider'])
iname=sess.get_inputs()[0].name
def run(x):
    x=np.concatenate([np.zeros(OL//2,np.float32),x.astype(np.float32)])
    wins=[]
    for i in range(0,len(x),STEP):
        w=x[i:i+N]
        if len(w)<N: w=np.pad(w,(0,N-len(w)))
        wins.append(w)
    W=np.stack(wins)[:,:,None]
    notes=[]; t0=time.time()
    for b in range(0,len(W),16):
        out=sess.run(['StatefulPartitionedCall:1','StatefulPartitionedCall:2'],{iname:W[b:b+16]})
        notes.append(out[0])
    el=time.time()-t0
    nt=np.concatenate(notes)                 # (nwin,172,88)
    h=OLF//2; nt=nt[:,h:-h,:].reshape(-1,88)
    n_frames=int((len(x)-OL//2)/STEP*(2*86-OLF))  # igual que unwrap_output (n_expected_windows * frames_per_window)
    return nt[:n_frames], el
for path,out in zip(sys.argv[1::2],sys.argv[2::2]):
    x=np.fromfile(path,dtype=np.float32); nt,el=run(x)
    nt.astype(np.float32).tofile(out)
    print(f'{out}: {len(x)/SR:.0f}s audio -> {nt.shape} notas, inferencia {el:.1f}s')
