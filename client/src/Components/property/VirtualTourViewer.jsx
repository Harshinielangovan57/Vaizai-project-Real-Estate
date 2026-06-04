// src/components/property/VirtualTourViewer.jsx
import { useEffect, useRef, useState } from 'react';

/**
 * VirtualTourViewer
 * Props:
 *   matterportUrl  – string | null   Matterport embed URL
 *   tour360Url     – string | null   Equirectangular image URL for Three.js viewer
 */
export default function VirtualTourViewer({ matterportUrl, tour360Url }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const [threeError, setThreeError] = useState(false);

  // ── Three.js 360° viewer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!tour360Url || matterportUrl) return;

    let animId;
    (async () => {
      try {
        const THREE = await import('three');
        const canvas = canvasRef.current;
        if (!canvas) return;

        const w = canvas.clientWidth;
        const h = canvas.clientHeight;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio);
        rendererRef.current = renderer;

        const scene  = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        camera.position.set(0, 0, 0.001);

        // Sphere geometry — inside face
        const geo = new THREE.SphereGeometry(500, 64, 32);
        geo.scale(-1, 1, 1);

        const loader = new THREE.TextureLoader();
        const texture = await new Promise((res, rej) =>
          loader.load(tour360Url, res, undefined, rej)
        );
        const mat  = new THREE.MeshBasicMaterial({ map: texture });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);

        // Drag-to-look
        let isDragging = false;
        let prevX = 0, prevY = 0;
        let lon = 0, lat = 0;

        const onDown  = (e) => { isDragging = true; prevX = e.clientX || e.touches?.[0]?.clientX; prevY = e.clientY || e.touches?.[0]?.clientY; };
        const onUp    = ()  => { isDragging = false; };
        const onMove  = (e) => {
          if (!isDragging) return;
          const cx = e.clientX || e.touches?.[0]?.clientX;
          const cy = e.clientY || e.touches?.[0]?.clientY;
          lon  -= (cx - prevX) * 0.2;
          lat  += (cy - prevY) * 0.2;
          lat   = Math.max(-85, Math.min(85, lat));
          prevX = cx; prevY = cy;
        };

        canvas.addEventListener('mousedown',  onDown);
        canvas.addEventListener('mousemove',  onMove);
        canvas.addEventListener('mouseup',    onUp);
        canvas.addEventListener('touchstart', onDown);
        canvas.addEventListener('touchmove',  onMove);
        canvas.addEventListener('touchend',   onUp);

        const animate = () => {
          animId = requestAnimationFrame(animate);
          const phi   = THREE.MathUtils.degToRad(90 - lat);
          const theta = THREE.MathUtils.degToRad(lon);
          camera.lookAt(
            500 * Math.sin(phi) * Math.cos(theta),
            500 * Math.cos(phi),
            500 * Math.sin(phi) * Math.sin(theta)
          );
          renderer.render(scene, camera);
        };
        animate();

        // Handle resize
        const onResize = () => {
          const nw = canvas.clientWidth;
          const nh = canvas.clientHeight;
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        };
        window.addEventListener('resize', onResize);

        return () => {
          cancelAnimationFrame(animId);
          renderer.dispose();
          window.removeEventListener('resize', onResize);
          canvas.removeEventListener('mousedown',  onDown);
          canvas.removeEventListener('mousemove',  onMove);
          canvas.removeEventListener('mouseup',    onUp);
          canvas.removeEventListener('touchstart', onDown);
          canvas.removeEventListener('touchmove',  onMove);
          canvas.removeEventListener('touchend',   onUp);
        };
      } catch {
        setThreeError(true);
      }
    })();

    return () => { cancelAnimationFrame(animId); rendererRef.current?.dispose(); };
  }, [tour360Url, matterportUrl]);

  // ── Matterport iframe ────────────────────────────────────────────────────
  if (matterportUrl) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/8">
        <div className="flex items-center justify-between border-b border-white/8 bg-neutral-900 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <span>🏠</span> Matterport 3D Tour
          </div>
          <a
            href={matterportUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-400 hover:underline"
          >
            Open full screen ↗
          </a>
        </div>
        <iframe
          src={matterportUrl}
          className="h-80 w-full"
          allow="fullscreen; xr-spatial-tracking"
          title="Matterport 3D Tour"
        />
      </div>
    );
  }

  // ── Three.js 360° viewer ─────────────────────────────────────────────────
  if (tour360Url) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/8">
        <div className="flex items-center justify-between border-b border-white/8 bg-neutral-900 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <span>🌐</span> 360° Virtual Tour
          </div>
          <span className="text-xs text-neutral-500">Drag to look around</span>
        </div>

        {threeError ? (
          <div className="flex h-64 items-center justify-center bg-neutral-900 text-neutral-500 text-sm">
            Could not load 3D viewer — open image directly
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="h-80 w-full cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
          />
        )}
      </div>
    );
  }

  return null;
}