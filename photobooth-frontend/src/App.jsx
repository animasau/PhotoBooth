import React, { useRef, useEffect, useState, useCallback } from "react";
import "./App.css";

const backgroundThemes = [
  { key: "yellow", label: "💛 Butter", accent: "#f7c948" },
  { key: "pinkgreen", label: "🌸 Mint", accent: "#f48fb1" },
  { key: "purple", label: "💜 Grape", accent: "#9c27b0" },
  { key: "black", label: "🖤 Mono", accent: "#424242" },
  { key: "blue", label: "💙 Ocean", accent: "#4ea9d3" }
];

const filters = [
  { value: "none", label: "✨ Natural" },
  { value: "grayscale(100%)", label: "🖤 Mono" },
  { value: "sepia(100%)", label: "📜 Sepia" },
  { value: "brightness(120%)", label: "☀️ Bright" },
  { value: "contrast(150%)", label: "⚡ Contrast" }
];

const seaStickers = ["🫧", "🐟", "🦑", "🪼", "🐚", "⭐"];

export default function App() {
  const videoRef = useRef();
  const [photos, setPhotos] = useState([]);
  const [frameCount, setFrameCount] = useState(2);
  const [stripBackground, setStripBackground] = useState("blue");
  const [filter, setFilter] = useState("none");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [stripUrl, setStripUrl] = useState("");
  const [stripQrUrl, setStripQrUrl] = useState("");

  const shutter = new Audio("https://www.soundjay.com/mechanical/camera-shutter-click-01.mp3");

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    });
  }, []);

  useEffect(() => {
    const constraints = selectedCamera ? { video: { deviceId: { exact: selectedCamera } } } : { video: true };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("Camera error:", err);
      });
  }, [selectedCamera]);

  const finalizeStrip = useCallback(async () => {
    if (photos.length === 0) return;

    const formData = new FormData();
    photos.forEach((p, i) => {
      const byteString = atob(p.photo.split(",")[1]);
      const mimeString = p.photo.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let j = 0; j < byteString.length; j++) {
        ia[j] = byteString.charCodeAt(j);
      }
      const blob = new Blob([ab], { type: mimeString });
      formData.append("files", blob, `photo${i}.png`);
    });

    try {
      const response = await fetch("http://127.0.0.1:8000/finalize_strip/", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      setStripUrl(data.strip_url);
      setStripQrUrl(data.strip_qr_url);
    } catch (err) {
      console.error("Error finalizing strip:", err);
    }
  }, [photos]);

  useEffect(() => {
    if (currentFrame === frameCount && photos.length === frameCount) {
      const timer = setTimeout(() => finalizeStrip(), 0);
      return () => clearTimeout(timer);
    }
  }, [currentFrame, photos, frameCount, finalizeStrip]);

  const takePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");

    if (filter !== "none") ctx.filter = filter;

    ctx.drawImage(videoRef.current, 0, 0);
    const imgData = canvas.toDataURL("image/png");

    shutter.play();
    setPhotos((prev) => [...prev, { photo: imgData }]);
  };

  const runSequence = (frameIndex) => {
    if (frameIndex >= frameCount) return;

    let count = 3;
    setCountdown(count);

    const countdownInterval = setInterval(() => {
      count -= 1;
      setCountdown(count);

      if (count === 0) {
        clearInterval(countdownInterval);
        takePhoto();
        setCurrentFrame(frameIndex + 1);

        if (frameIndex + 1 < frameCount) {
          setTimeout(() => runSequence(frameIndex + 1), 1000);
        }
      }
    }, 1000);
  };

  const startCaptureSequence = () => {
    setPhotos([]);
    setCurrentFrame(0);
    setStripUrl("");
    setStripQrUrl("");
    runSequence(0);
  };

  const resetStrip = () => {
    setPhotos([]);
    setCurrentFrame(0);
    setCountdown(null);
    setStripUrl("");
    setStripQrUrl("");
  };

  const progressPercent = Math.round((currentFrame / frameCount) * 100);
  const activeTheme = backgroundThemes.find((theme) => theme.key === stripBackground);

  return (
    <div className={`app ${stripBackground}`}>
      <header className="title-wrap">
        <p className="pill">Underwater Kawaii Booth</p>
        <h1>🫧 Ocean Frame Studio 🫧</h1>
        <p className="subtitle">Inspired by your reference: soft aqua frame, bubbles, tiny fish and cute sticker vibes.</p>
      </header>

      <div className="dashboard-grid">
        <aside className="controls-pane card">
          <h3>📷 Camera</h3>
          <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
            {cameras.map((cam, i) => (
              <option key={cam.deviceId || i} value={cam.deviceId}>
                {cam.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>

          <h3>🧁 Layout</h3>
          <div className="chip-row">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                className={frameCount === n ? "chip active" : "chip"}
                onClick={() => {
                  setFrameCount(n);
                  resetStrip();
                }}
              >
                {n} Frames
              </button>
            ))}
          </div>

          <h3>🎨 Theme</h3>
          <div className="chip-row">
            {backgroundThemes.map((theme) => (
              <button
                key={theme.key}
                className={stripBackground === theme.key ? "chip active" : "chip"}
                onClick={() => setStripBackground(theme.key)}
              >
                {theme.label}
              </button>
            ))}
          </div>

          <h3>🪄 Filter</h3>
          <div className="chip-row">
            {filters.map((style) => (
              <button
                key={style.value}
                className={filter === style.value ? "chip active" : "chip"}
                onClick={() => setFilter(style.value)}
              >
                {style.label}
              </button>
            ))}
          </div>

          <section className="status-bar">
            <p>Session Progress</p>
            <div className="progress-track" role="progressbar" aria-valuenow={progressPercent}>
              <div className="progress-fill" style={{ width: `${progressPercent}%`, background: activeTheme?.accent }} />
            </div>
            <div className="frame-dots">
              {Array.from({ length: frameCount }).map((_, index) => (
                <span key={index} className={index < currentFrame ? "dot active" : "dot"} />
              ))}
            </div>
          </section>
        </aside>

        <main className="preview-pane card">
          <section className="inspo-frame">
            <div className="sea-decoration" aria-hidden="true">
              {seaStickers.map((s, i) => (
                <span key={`${s}-${i}`} className={`sea-item sea-item-${i + 1}`}>{s}</span>
              ))}
            </div>

            <div className="camera-window">
              <video ref={videoRef} autoPlay muted style={{ filter }} />
              {countdown !== null && countdown > 0 && <div className="countdown-bubble">{countdown}</div>}
            </div>

            <div className="frame-divider" />

            <div className="mini-strip">
              {Array.from({ length: frameCount }).map((_, i) => (
                <div key={i} className="mini-window">
                  {photos[i] ? <img src={photos[i].photo} alt={`captured ${i + 1}`} style={{ filter }} /> : <p>Snap {i + 1}</p>}
                </div>
              ))}
            </div>
          </section>

          <div className="controls">
            <button className="capture-btn" onClick={startCaptureSequence}>📸 Start Cute Session</button>
            <button className="capture-btn secondary" onClick={resetStrip}>🔄 Reset Strip</button>
          </div>
        </main>
      </div>

      {stripUrl && (
        <section className="final-strip">
          <h2>Your kawaii strip is ready! 💖</h2>
          <img src={stripUrl} alt="Collage Strip" className="strip-preview" />
          <div className="download-actions">
            <a href={stripUrl} download="strip.png" className="download-btn">
              ⬇️ Download Your Strip
            </a>
            {stripQrUrl && (
              <div className="qr-section">
                <h4>Scan to Download</h4>
                <img src={stripQrUrl} alt="QR Code" className="qr-code" />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
