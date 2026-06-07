// src/hooks/use360Viewer.js
import { useEffect, useRef, useCallback } from 'react';

/**
 * use360Viewer
 *
 * Initialises a Three.js equirectangular 360° viewer inside a <canvas> element.
 *
 * Props:
 *   canvasRef   – React ref pointing at the <canvas>
 *   imageUrl    – string  equirectangular image URL
 *   hotspots    – Array<{ id, lon, lat, label, targetLon, targetLat }>
 *   onHotspot   – (hotspot) => void  called when user clicks a hotspot
 *   initialLon  – number  starting horizontal angle (default 0)
 *   initialLat  – number  starting vertical angle   (default 0)
 *
 * Returns:
 *   { jumpTo(lon, lat) }  – imperative API to animate camera to a position
 */
export function use360Viewer({
  canvasRef,
  imageUrl,
  hotspots = [],
  onHotspot,
  initialLon = 0,
  initialLat = 0,
}) {
  // Store mutable camera state outside React to avoid re-renders
  const stateRef = useRef({
    lon: initialLon,
    lat: initialLat,
    isDragging: false,
    prevX: 0,
    prevY: 0,
    animating: false,
    targetLon: initialLon,
    targetLat: initialLat,
  });

  const threeRef = useRef(null); // { renderer, scene, camera, sphere, hotspotMeshes }
  const animIdRef = useRef(null);

  // ── Init Three.js ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return;

    let cancelled = false;

    (async () => {
      const THREE = await import('three');
      if (cancelled || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Scene + camera
      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
      camera.position.set(0, 0, 0.001);

      // 360° sphere (inside face)
      const geo = new THREE.SphereGeometry(500, 64, 32);
      geo.scale(-1, 1, 1);
      const loader = new THREE.TextureLoader();

      let sphere;
      try {
        const texture = await new Promise((res, rej) =>
          loader.load(imageUrl, res, undefined, rej)
        );
        if (cancelled) return;
        const mat = new THREE.MeshBasicMaterial({ map: texture });
        sphere = new THREE.Mesh(geo, mat);
        scene.add(sphere);
      } catch {
        if (cancelled) return;
        // Fallback: solid colour sphere so viewer still mounts
        const mat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
        sphere = new THREE.Mesh(geo, mat);
        scene.add(sphere);
      }

      // ── Hotspot sprites ──────────────────────────────────────────────────
      const hotspotMeshes = [];
      for (const hs of hotspots) {
        // Convert lon/lat to 3-D position on the sphere
        const phi   = THREE.MathUtils.degToRad(90 - hs.lat);
        const theta = THREE.MathUtils.degToRad(hs.lon);
        const r     = 490; // just inside sphere

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.sin(theta);

        const spriteMat = new THREE.SpriteMaterial({
          color:       0x6366f1,
          sizeAttenuation: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(0.06, 0.06, 1);
        sprite.position.set(x, y, z);
        sprite.userData = hs;
        scene.add(sprite);
        hotspotMeshes.push(sprite);
      }

      threeRef.current = { renderer, scene, camera, sphere, hotspotMeshes };

      // ── Animate loop ─────────────────────────────────────────────────────
      const s = stateRef.current;

      const animate = () => {
        animIdRef.current = requestAnimationFrame(animate);

        // Smooth camera animation toward target
        if (s.animating) {
          s.lon += (s.targetLon - s.lon) * 0.08;
          s.lat += (s.targetLat - s.lat) * 0.08;
          if (
            Math.abs(s.targetLon - s.lon) < 0.1 &&
            Math.abs(s.targetLat - s.lat) < 0.1
          ) {
            s.lon = s.targetLon;
            s.lat = s.targetLat;
            s.animating = false;
          }
        }

        const clampedLat = Math.max(-85, Math.min(85, s.lat));
        const phi   = THREE.MathUtils.degToRad(90 - clampedLat);
        const theta = THREE.MathUtils.degToRad(s.lon);

        camera.lookAt(
          500 * Math.sin(phi) * Math.cos(theta),
          500 * Math.cos(phi),
          500 * Math.sin(phi) * Math.sin(theta)
        );

        renderer.render(scene, camera);
      };
      animate();

      // ── Resize ───────────────────────────────────────────────────────────
      const onResize = () => {
        const nw = canvas.clientWidth;
        const nh = canvas.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      };
      window.addEventListener('resize', onResize);

      threeRef.current._cleanup = () => {
        window.removeEventListener('resize', onResize);
        cancelAnimationFrame(animIdRef.current);
        renderer.dispose();
      };
    })();

    return () => {
      cancelled = true;
      threeRef.current?._cleanup?.();
      threeRef.current = null;
    };
  }, [imageUrl]);

  // ── Pointer/touch drag ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const s = stateRef.current;

    const getXY = (e) => ({
      x: e.clientX ?? e.touches?.[0]?.clientX ?? 0,
      y: e.clientY ?? e.touches?.[0]?.clientY ?? 0,
    });

    const onDown = (e) => {
      s.isDragging = true;
      s.animating  = false;
      const { x, y } = getXY(e);
      s.prevX = x; s.prevY = y;
    };
    const onUp = () => { s.isDragging = false; };
    const onMove = (e) => {
      if (!s.isDragging) return;
      const { x, y } = getXY(e);
      s.lon  -= (x - s.prevX) * 0.18;
      s.lat  += (y - s.prevY) * 0.18;
      s.prevX = x; s.prevY = y;
    };

    canvas.addEventListener('mousedown',  onDown);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mouseup',    onUp);
    window.addEventListener('touchend',   onUp);
    canvas.addEventListener('mousemove',  onMove);
    canvas.addEventListener('touchmove',  onMove, { passive: true });

    return () => {
      canvas.removeEventListener('mousedown',  onDown);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('mouseup',    onUp);
      window.removeEventListener('touchend',   onUp);
      canvas.removeEventListener('mousemove',  onMove);
      canvas.removeEventListener('touchmove',  onMove);
    };
  }, []);

  // ── Hotspot click detection (raycasting) ───────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onHotspot) return;

    const onClick = (e) => {
      const three = threeRef.current;
      if (!three) return;
      const { renderer, camera, hotspotMeshes } = three;

      const rect = canvas.getBoundingClientRect();
      const x    = ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
      const y   = -((e.clientY - rect.top)   / rect.height) * 2 + 1;

      const { THREE: _THREE } = three;
      // Lazy import THREE for raycaster
      import('three').then((THREE) => {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x, y }, camera);
        const hits = raycaster.intersectObjects(hotspotMeshes);
        if (hits.length > 0) {
          onHotspot(hits[0].object.userData);
        }
      });
    };

    canvas.addEventListener('click', onClick);
    return () => canvas.removeEventListener('click', onClick);
  }, [onHotspot]);

  // ── Imperative jumpTo ──────────────────────────────────────────────────────
  const jumpTo = useCallback((lon, lat) => {
    const s = stateRef.current;
    s.targetLon = lon;
    s.targetLat = lat;
    s.animating = true;
  }, []);

  return { jumpTo };
}