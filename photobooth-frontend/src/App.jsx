import React, { useRef, useEffect, useState } from "react";
import "./App.css";

export default function App() {
  const videoRef = useRef();
  const [photos, setPhotos] = useState([]);
  const [frameCount, setFrameCount] = useState(2);
  const [stripBackground, setStripBackground] = useState("pink");
  const [filter, setFilter] = useState("none");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [stripUrl, setStripUrl] = useState("");   // ✅ backend strip URL
  const [stripQrUrl, setStripQrUrl] = useState(""); // ✅ backend QR URL

  const shutter = new Audio("https://www.soundjay.com/mechanical/camera-shutter-click-01.mp3");

  // Enumerate devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    });
  }, []);

  // Start camera when selectedCamera changes
  useEffect(() => {
    const constraints = selectedCamera
      ? { video: { deviceId: { exact: selectedCamera } } }
      : { video: true };

    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("Camera error:", err);
      });
  }, [selectedCamera]);

  // ✅ Trigger finalizeStrip only after all frames are captured
  useEffect(() => {
    if (currentFrame === frameCount && photos.length === frameCount) {
      finalizeStrip();
    }
  }, [currentFrame, photos]);

  // Start full capture sequence
  const startCaptureSequence = () => {
    setPhotos([]);
    setCurrentFrame(0);
    runSequence(0);
  };

  const runSequence = (frameIndex) => {
    if (frameIndex >= frameCount) return;

    let count = 3;
    setCountdown(count);

    const countdownInterval = setInterval(() => {
      count--;
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

  // Send captured photos to backend
  const finalizeStrip = async () => {
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
  };

  const resetStrip = () => {
    setPhotos([]);
    setCurrentFrame(0);
    setCountdown(null);
    setStripUrl("");
    setStripQrUrl("");
  };

  return (
    <div className={`app ${stripBackground}`}>
      <h1>🎀 Photo Studio 🎀</h1>

      {/* Camera Selector */}
      <div className="selector">
        <h3>Select Camera</h3>
        <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
          {cameras.map((cam, i) => (
            <option key={i} value={cam.deviceId}>
              {cam.label || `Camera ${i + 1}`}
            </option>
          ))}
        </select>
      </div>

      {/* Frame Count Selector */}
      <div className="selector">
        <h3>Choose layout</h3>
        {[2, 3, 4, 5, 6].map((n) => (
          <button key={n} onClick={() => { setFrameCount(n); resetStrip(); }}>
            {n} Frames
          </button>
        ))}
      </div>

      {/* Background Selector */}
      <div className="selector">
        <h3>Choose Background</h3>
        <button onClick={() => setStripBackground("yellow")}>💛 Yellow</button>
        <button onClick={() => setStripBackground("pinkgreen")}>🌸💚 Pink Green</button>
        <button onClick={() => setStripBackground("purple")}>💜 Purple</button>
        <button onClick={() => setStripBackground("black")}>🖤 Black</button>
        <button onClick={() => setStripBackground("blue")}>💙 Blue</button>
      </div>

      {/* Filter Selector */}
      <div className="selector">
        <h3>Choose Filter</h3>
        <button onClick={() => setFilter("none")}>✨ None</button>
        <button onClick={() => setFilter("grayscale(100%)")}>🖤 Grayscale</button>
        <button onClick={() => setFilter("sepia(100%)")}>📜 Sepia</button>
        <button onClick={() => setFilter("brightness(120%)")}>☀️ Bright</button>
        <button onClick={() => setFilter("contrast(150%)")}>⚡ Contrast</button>
      </div>

      {/* Camera Preview */}
      <div className="camera-wrapper">
        <video ref={videoRef} autoPlay muted style={{ filter: filter }} />
      </div>

      {/* Countdown */}
      {countdown !== null && countdown > 0 && (
        <h2 style={{ color: "#ff69b4" }}>📸 {countdown}...</h2>
      )}

      <div className="controls">
        <button className="capture-btn" onClick={startCaptureSequence}>
          📸 Start Capture Sequence
        </button>
        <button className="capture-btn" onClick={resetStrip}>
          🔄 Reset Strip
        </button>
      </div>

      {/* Captured Photos (keep same strip background during capture) */}
      <div className={`strip ${stripBackground}`}>
        {photos.map((p, i) => (
          <img key={i} src={p.photo} alt="photo" style={{ filter: filter }} />
        ))}
      </div>

      {/* ✅ Final booth strip shown separately */}
      {stripUrl && (
        <div className={`final-strip ${stripBackground}`}>
          <h2>Your photo Booth </h2>
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
        </div>
      )}

      <h3>
        Frames Taken: {currentFrame}/{frameCount}
      </h3>
    </div>
  );
}