import React, { useRef, useEffect, useState, useCallback } from "react";
import "./App.css";

const backgroundThemes = [
  { key: "blue", label: "💙 Ocean", accent: "#2f9dd2" },
  { key: "yellow", label: "💛 Butter", accent: "#efb40d" },
  { key: "pinkgreen", label: "🌸 Mint", accent: "#f48fb1" },
  { key: "purple", label: "💜 Grape", accent: "#8d4ad5" },
  { key: "black", label: "🖤 Mono", accent: "#3b3b3b" }
];

const filters = [
  { value: "none", label: "✨ Natural" },
  { value: "grayscale(100%)", label: "🖤 Mono" },
  { value: "sepia(100%)", label: "📜 Sepia" },
  { value: "brightness(120%)", label: "☀️ Bright" },
  { value: "contrast(150%)", label: "⚡ Contrast" }
];

const presetStickers = ["🐟", "🦑", "🌿", "🪼", "🫧", "⭐", "💗", "🎀"];

export default function App() {
  const videoRef = useRef();
  const frameRef = useRef();
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
  const [stickers, setStickers] = useState([]);
  const [customEmoji, setCustomEmoji] = useState("");

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
      for (let j = 0; j < byteString.length; j += 1) ia[j] = byteString.charCodeAt(j);
      const blob = new Blob([ab], { type: mimeString });
      formData.append("files", blob, `photo${i}.png`);
    });

    try {
      const response = await fetch("http://127.0.0.1:8000/finalize_strip/", { method: "POST", body: formData });
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

  const drawStickersOnCanvas = async (ctx, width, height) => {
    for (const sticker of stickers) {
      const xPx = sticker.x * width;
      const yPx = sticker.y * height;
      const sizePx = sticker.size * Math.min(width, height);

      if (sticker.type === "emoji") {
        ctx.font = `${Math.max(sizePx, 18)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(sticker.value, xPx, yPx);
      }

      if (sticker.type === "image") {
        const img = await new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.src = sticker.value;
        });
        ctx.drawImage(img, xPx - sizePx / 2, yPx - sizePx / 2, sizePx, sizePx);
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

  const addSticker = (type, value) => {
    setStickers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type, value, x: 0.5, y: 0.5, size: 0.12 }
    ]);
  };

  const clearStickers = () => setStickers([]);

  const moveSticker = (id, event) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.min(0.95, Math.max(0.05, (event.clientX - rect.left) / rect.width));
    const y = Math.min(0.95, Math.max(0.05, (event.clientY - rect.top) / rect.height));

    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, x, y } : s)));
  };

  const handleCustomEmoji = () => {
    if (!customEmoji.trim()) return;
    addSticker("emoji", customEmoji.trim());
    setCustomEmoji("");
  };

  const onImageStickerUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addSticker("image", reader.result);
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const progressPercent = Math.round((currentFrame / frameCount) * 100);
  const activeTheme = backgroundThemes.find((theme) => theme.key === stripBackground);

  return (
    <div className={`app ${stripBackground}`}>
      <div className="new-badge">NEW LOOK · STICKERS ENABLED</div>
      <h1>🫧 Kawaii Ocean Booth 🫧</h1>

      <div className="layout">
        <aside className="panel">
          <h3>Camera</h3>
          <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
            {cameras.map((cam, i) => (
              <option key={cam.deviceId || i} value={cam.deviceId}>{cam.label || `Camera ${i + 1}`}</option>
            ))}
          </select>

          <h3>Frames</h3>
          <div className="chip-row">
            {[2, 3, 4].map((n) => (
              <button key={n} className={frameCount === n ? "chip active" : "chip"} onClick={() => { setFrameCount(n); resetStrip(); }}>
                {n}
              </button>
            ))}
          </div>

          <h3>Theme</h3>
          <div className="chip-row">
            {backgroundThemes.map((theme) => (
              <button key={theme.key} className={stripBackground === theme.key ? "chip active" : "chip"} onClick={() => setStripBackground(theme.key)}>
                {theme.label}
              </button>
            ))}
          </div>

          <h3>Filter</h3>
          <div className="chip-row">
            {filters.map((style) => (
              <button key={style.value} className={filter === style.value ? "chip active" : "chip"} onClick={() => setFilter(style.value)}>
                {style.label}
              </button>
            ))}
          </div>

          <h3>Add Stickers (drag on preview)</h3>
          <div className="sticker-palette">
            {presetStickers.map((sticker) => (
              <button key={sticker} className="sticker-chip" onClick={() => addSticker("emoji", sticker)}>{sticker}</button>
            ))}
            <button className="sticker-chip reset" onClick={clearStickers}>Reset</button>
          </div>

          <div className="custom-sticker-row">
            <input
              type="text"
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)}
              placeholder="Add custom emoji"
              maxLength={4}
            />
            <button className="chip" onClick={handleCustomEmoji}>Add Emoji</button>
          </div>

          <label className="upload-sticker">
            Upload sticker image
            <input type="file" accept="image/*" onChange={onImageStickerUpload} />
          </label>

          <div className="progress-track"><div className="progress-fill" style={{ width: `${progressPercent}%`, background: activeTheme?.accent }} /></div>
          <p className="progress-text">{currentFrame}/{frameCount} captured</p>
        </aside>

        <main className="booth-card">
          <div className="frame-shell">
            <div className="window main-window" ref={frameRef}>
              <video ref={videoRef} autoPlay muted style={{ filter }} />

              {stickers.map((sticker) => (
                <button
                  key={sticker.id}
                  className="placed-sticker"
                  style={{ left: `${sticker.x * 100}%`, top: `${sticker.y * 100}%`, fontSize: `${sticker.size * 140}px` }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (event.buttons !== 1) return;
                    moveSticker(sticker.id, event);
                  }}
                >
                  {sticker.type === "emoji" ? (
                    sticker.value
                  ) : (
                    <img src={sticker.value} alt="custom sticker" />
                  )}
                </button>
              ))}

              {countdown !== null && countdown > 0 && <div className="countdown">{countdown}</div>}
            </div>

            <div className="divider" />

            <div className="strip-grid">
              {Array.from({ length: frameCount }).map((_, i) => (
                <div key={i} className="window thumb-window">
                  {photos[i] ? <img src={photos[i].photo} alt={`snap ${i + 1}`} style={{ filter }} /> : <span>SNAP {i + 1}</span>}
                </div>
              ))}
            </div>

            <div className="bubble b1">🫧</div><div className="bubble b2">🐟</div><div className="bubble b3">⭐</div>
          </div>

          <div className="controls">
            <button className="capture-btn" onClick={startCaptureSequence}>📸 Start</button>
            <button className="capture-btn secondary" onClick={resetStrip}>Reset Strip</button>
          </div>
        </main>
      </div>

      {stripUrl && (
        <section className="final-strip">
          <h2>Finished strip 💖</h2>
          <img src={stripUrl} alt="Collage Strip" className="strip-preview" />
          <div className="download-actions">
            <a href={stripUrl} download="strip.png" className="download-btn">⬇️ Download</a>
            {stripQrUrl && <img src={stripQrUrl} alt="QR Code" className="qr-code" />}
          </div>
        </section>
      )}
    </div>
  );
}