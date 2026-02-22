import React, { useRef, useEffect, useState, useCallback } from "react";
import "./App.css";

const backgroundThemes = [
  { key: "yellow", label: "💛 Honey Cream" },
  { key: "pinkgreen", label: "🌸 Mint Blossom" },
  { key: "purple", label: "💜 Lavender Dream" },
  { key: "black", label: "🖤 Monochrome Chic" },
  { key: "blue", label: "💙 Blueberry Soda" }
];

const filters = [
  { value: "none", label: "✨ Natural" },
  { value: "grayscale(100%)", label: "🖤 Vintage Mono" },
  { value: "sepia(100%)", label: "📜 Warm Sepia" },
  { value: "brightness(120%)", label: "☀️ Glow Up" },
  { value: "contrast(150%)", label: "⚡ Pop Contrast" }
];

export default function App() {
  const videoRef = useRef();
  const frameRef = useRef();
  const [photos, setPhotos] = useState([]);
  const [frameCount, setFrameCount] = useState(2);
  const [stripBackground, setStripBackground] = useState("pinkgreen");
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
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => console.error("Camera error:", err));
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

  const startCaptureSequence = () => {
    setPhotos([]);
    setCurrentFrame(0);
    setStripUrl("");
    setStripQrUrl("");
    runSequence(0);
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
        if (frameIndex + 1 < frameCount) setTimeout(() => runSequence(frameIndex + 1), 1000);
      }
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");

    if (filter !== "none") ctx.filter = filter;
    ctx.drawImage(videoRef.current, 0, 0);
    await drawStickersOnCanvas(ctx, canvas.width, canvas.height);

    shutter.play();
    setPhotos((prev) => [...prev, { photo: canvas.toDataURL("image/png") }]);
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
      <div className="bg-decor decor-left">✨🧸🌈</div>
      <div className="bg-decor decor-right">🍓💫🎀</div>

      <header className="title-wrap">
        <p className="pill">Kawaii Photo Club</p>
        <h1>🎀 Cute Photo Booth 🎀</h1>
        <p className="subtitle">Capture soft, sweet memories with dreamy themes and playful vibes.</p>
      </header>

      <div className="selector-grid">
        <div className="selector card">
          <h3>📷 Camera</h3>
          <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
            {cameras.map((cam, i) => (
              <option key={cam.deviceId || i} value={cam.deviceId}>
                {cam.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div className="selector card">
          <h3>🧁 Layout</h3>
          {[2, 3, 4, 5, 6].map((n) => (
            <button key={n} onClick={() => { setFrameCount(n); resetStrip(); }}>
              {n} Frames
            </button>
          ))}
        </div>

        <div className="selector card">
          <h3>🎨 Theme</h3>
          {backgroundThemes.map((theme) => (
            <button key={theme.key} onClick={() => setStripBackground(theme.key)}>
              {theme.label}
            </button>
          ))}
        </div>

        <div className="selector card">
          <h3>🪄 Filter</h3>
          {filters.map((style) => (
            <button key={style.value} onClick={() => setFilter(style.value)}>
              {style.label}
            </button>
          ))}
        </div>
      </div>

      <div className="camera-wrapper">
        <video ref={videoRef} autoPlay muted style={{ filter }} />
      </div>

      {countdown !== null && countdown > 0 && <h2 className="countdown">📸 {countdown}...</h2>}

      <div className="controls">
        <button className="capture-btn" onClick={startCaptureSequence}>📸 Start Cute Session</button>
        <button className="capture-btn secondary" onClick={resetStrip}>🔄 Reset Strip</button>
      </div>

      <div className={`strip ${stripBackground}`}>
        {photos.map((p, i) => (
          <img key={i} src={p.photo} alt="photo" style={{ filter }} />
        ))}
      </div>

      {stripUrl && (
        <div className={`final-strip ${stripBackground}`}>
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
          </div></div>
        
      )}

      <h3 className="frame-progress">Frames Taken: {currentFrame}/{frameCount}</h3>
    </div>
  );
}
