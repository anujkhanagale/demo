import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import {
  ClampToEdgeWrapping,
  FrontSide,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Check,
  Laptop,
  Plus,
  RotateCcw,
  Sparkles,
  Minus,
} from "lucide-react";
import laptopSkins, { laptopBaseColors } from "./laptopSkins.js";
import {
  createInnerDisplayGeometry,
  createLidShellGeometry,
  createOuterLidGeometry,
  createRoundedRectangle,
  LID_CORNER_RADIUS,
  LID_HEIGHT,
  LID_WIDTH,
  VINYL_THICKNESS,
} from "./laptopGeometry.js";

const views = {
  angle: [2.8, -4.8, 3.1],
  front: [0, 5.5, 2.7],
  back: [0, -5.5, 2.7],
  side: [5.5, 0, 2.7],
};

function OuterLidSkin({ skin, geometry }) {
  const texture = useLoader(TextureLoader, skin.artwork);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.anisotropy = 4;

  return (
    <mesh
      name="outer-lid-vinyl"
      geometry={geometry}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        map={texture}
        roughness={0.78}
        metalness={0}
        side={FrontSide}
      />
    </mesh>
  );
}

function LaptopModel({ skin, baseColor, showSkin }) {
  const lidShape = useMemo(
    () => createRoundedRectangle(LID_WIDTH, LID_HEIGHT, LID_CORNER_RADIUS),
    [],
  );
  const lidGeometry = useMemo(() => createLidShellGeometry(lidShape), [lidShape]);
  const outerSurfaceZ = lidGeometry.boundingBox.max.z;
  const innerSurfaceZ = lidGeometry.boundingBox.min.z;
  const outerSkinGeometry = useMemo(
    () => createOuterLidGeometry(lidShape, outerSurfaceZ),
    [lidShape, outerSurfaceZ],
  );
  const keys = useMemo(
    () =>
      Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 13 }, (_, column) => ({
          x: -1.28 + column * 0.212,
          y: -0.88 + row * 0.18,
          width: row === 4 && column === 6 ? 0.55 : 0.16,
          key: `${row}-${column}`,
        })),
      ).flat(),
    [],
  );
  const displayGeometry = useMemo(
    () => createInnerDisplayGeometry(innerSurfaceZ),
    [innerSurfaceZ],
  );

  return (
    <group>
      <RoundedBox
        args={[3.5, 2.35, 0.16]}
        radius={0.09}
        smoothness={5}
        position={[0, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={baseColor} metalness={0.74} roughness={0.29} />
      </RoundedBox>

      <mesh position={[0, 0, 0.083]}>
        <boxGeometry args={[3.25, 2.12, 0.018]} />
        <meshStandardMaterial color="#252a32" metalness={0.18} roughness={0.74} />
      </mesh>

      {keys.map((key) => (
        <RoundedBox
          key={key.key}
          args={[key.width, 0.125, 0.035]}
          radius={0.025}
          smoothness={2}
          position={[key.x, key.y, 0.116]}
          castShadow
        >
          <meshStandardMaterial color="#15181d" metalness={0.2} roughness={0.48} />
        </RoundedBox>
      ))}

      <RoundedBox
        args={[0.95, 0.58, 0.009]}
        radius={0.055}
        smoothness={5}
        position={[0, 0.67, 0.097]}
      >
        <meshStandardMaterial color="#747e89" metalness={0.45} roughness={0.42} />
      </RoundedBox>
      <mesh position={[0, 0.67, 0.103]}>
        <boxGeometry args={[0.88, 0.51, 0.004]} />
        <meshStandardMaterial color={baseColor} metalness={0.52} roughness={0.39} />
      </mesh>

      <mesh position={[0, -1.12, 0.105]}>
        <cylinderGeometry args={[0.065, 0.065, 3.05, 24]} />
        <meshStandardMaterial color="#858b92" metalness={0.8} roughness={0.25} />
      </mesh>

      <group
        name="rotating-display-lid-assembly"
        position={[0, -1.11, 0.12]}
        rotation={[Math.PI / 2 + 0.23, 0, 0]}
      >
        <mesh geometry={lidGeometry} castShadow receiveShadow>
          <meshStandardMaterial color={baseColor} metalness={0.72} roughness={0.29} />
        </mesh>
        <mesh
          name="inner-display"
          geometry={displayGeometry}
        >
          <meshStandardMaterial color="#10141c" metalness={0.12} roughness={0.24} />
        </mesh>
        <mesh
          name="inner-camera"
          position={[0, 1.04, innerSurfaceZ - VINYL_THICKNESS * 6]}
          rotation={[0, Math.PI, 0]}
        >
          <circleGeometry args={[0.055, 24]} />
          <meshStandardMaterial color="#626c77" metalness={0.3} roughness={0.42} />
        </mesh>
        {skin && showSkin && (
          <OuterLidSkin
            skin={skin}
            geometry={outerSkinGeometry}
          />
        )}
      </group>

      <RoundedBox
        args={[3.34, 0.08, 0.075]}
        radius={0.035}
        smoothness={3}
        position={[0, 1.12, -0.04]}
      >
        <meshStandardMaterial color="#77818c" metalness={0.78} roughness={0.25} />
      </RoundedBox>
    </group>
  );
}

function LaptopScene({ skin, baseColor, showSkin, controlsRef, setActiveView }) {
  return (
    <>
      <color attach="background" args={["#11121a"]} />
      <ambientLight intensity={1.05} />
      <directionalLight
        position={[2.8, 3.5, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-4, -2, 3]} intensity={1.3} color="#9b9dff" />
      <pointLight position={[1, 0, 4]} intensity={0.85} color="#79d8ff" />
      <mesh position={[0, 0, -0.22]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial transparent opacity={0.24} />
      </mesh>
      <LaptopModel skin={skin} baseColor={baseColor} showSkin={showSkin} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        onStart={() => setActiveView(null)}
        enablePan={false}
        minDistance={4.5}
        maxDistance={9}
        maxPolarAngle={Math.PI * 0.49}
        minPolarAngle={0.18}
        target={[0, 0, 0.72]}
        enableDamping
        dampingFactor={0.07}
      />
    </>
  );
}

function LaptopCustomizer({ onAddToCart }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedSkinId, setSelectedSkinId] = useState(laptopSkins[0].id);
  const [baseColor, setBaseColor] = useState(laptopBaseColors[0].value);
  const [showSkin, setShowSkin] = useState(true);
  const [notice, setNotice] = useState("");
  const [activeView, setActiveView] = useState("back");
  const controlsRef = useRef(null);
  const selectedSkin = laptopSkins.find((skin) => skin.id === selectedSkinId);
  const categories = ["All", ...new Set(laptopSkins.map((skin) => skin.category))];
  const filteredSkins = activeCategory === "All"
    ? laptopSkins
    : laptopSkins.filter((skin) => skin.category === activeCategory);

  const setView = (view) => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.reset();
    controls.object.position.set(...views[view]);
    controls.target.set(0, 0, 0.72);
    controls.object.up.set(0, 0, 1);
    controls.object.lookAt(controls.target);
    controls.update();
    controls.saveState();
    setActiveView(view);
  };

  const zoom = (factor) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const offset = controls.object.position.clone().sub(controls.target);
    offset.multiplyScalar(factor);
    controls.object.position.copy(controls.target).add(offset);
    controls.update();
  };

  const resetDesign = () => {
    setSelectedSkinId(laptopSkins[0].id);
    setBaseColor(laptopBaseColors[0].value);
    setShowSkin(true);
    setView("back");
    setNotice("");
  };

  const addDesignToBag = () => {
    onAddToCart({
      id: 100 + selectedSkin.id,
      skinId: selectedSkin.id,
      name: `Laptop Skin — ${selectedSkin.name}`,
      character: `${selectedSkin.category} · Custom laptop skin`,
      price: selectedSkin.price,
      tag: "CUSTOM LAPTOP SKIN",
      image: selectedSkin.artwork,
      imageAlt: `${selectedSkin.name} laptop skin design preview`,
      baseColor,
    });
    setNotice(`${selectedSkin.name} added to your bag.`);
  };

  return (
    <section className="laptop-studio" aria-labelledby="laptop-studio-title">
      <div className="laptop-studio-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow-line" /> YOUR DESIGN. YOUR DEVICE.</span>
          <h2 id="laptop-studio-title">DESIGN YOUR<br /><span>LAPTOP.</span></h2>
        </div>
        <p>Dress your daily carry in an original anime-inspired skin.<br />Drag to inspect your design from every angle.</p>
      </div>

      <div className="laptop-studio-layout">
        <aside className="skin-library" aria-label="Laptop skin library">
          <div className="studio-panel-heading">
            <span>01 / DESIGN LIBRARY</span><span>{filteredSkins.length.toString().padStart(2, "0")} DESIGNS</span>
          </div>
          <div className="skin-categories" aria-label="Filter by anime collection">
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                className={activeCategory === category ? "active" : ""}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="skin-grid">
            {filteredSkins.map((skin) => (
              <button
                type="button"
                key={skin.id}
                className={`skin-card ${selectedSkinId === skin.id ? "selected" : ""}`}
                onClick={() => {
                  setSelectedSkinId(skin.id);
                  setShowSkin(true);
                  setNotice("");
                  setView("back");
                }}
                aria-pressed={selectedSkinId === skin.id}
              >
                <span className="skin-card-art">
                  <img src={skin.artwork} alt="" loading="lazy" />
                  {selectedSkinId === skin.id && <span className="skin-selected-mark"><Check size={13} /></span>}
                </span>
                <span className="skin-card-category">{skin.category}</span>
                <strong>{skin.name}</strong>
                <span className="skin-card-price">₹{skin.price.toLocaleString("en-IN")}</span>
              </button>
            ))}
          </div>
          <p className="skin-art-note">Original graphic designs inspired by anime aesthetics. No character artwork is used.</p>
        </aside>

        <div className="laptop-preview-panel">
          <div className="preview-toolbar">
            <span><span className="preview-live-dot" /> LIVE 3D PREVIEW</span>
            <span>GENERIC 14″ LAPTOP / CONCEPT MODEL</span>
          </div>
          <div className="laptop-canvas-wrap">
            <Canvas
              shadows="basic"
              dpr={[1, 1.5]}
              camera={{ position: views.back, fov: 34, near: 0.1, far: 100, up: [0, 0, 1] }}
              gl={{ antialias: true, powerPreference: "low-power" }}
              fallback={<div className="laptop-canvas-fallback">Interactive 3D preview is not supported by this browser.</div>}
            >
              <Suspense fallback={null}>
                <LaptopScene
                  skin={selectedSkin}
                  baseColor={baseColor}
                  showSkin={showSkin}
                  controlsRef={controlsRef}
                  setActiveView={setActiveView}
                />
              </Suspense>
            </Canvas>
            <div className="preview-drag-tip"><RotateCcw size={13} /> DRAG TO ROTATE <span>·</span> SCROLL TO ZOOM</div>
          </div>
          <div className="laptop-view-controls">
              <span>DRAG TO ORBIT 360°</span>
              <button type="button" aria-pressed={activeView === "back"} onClick={() => setView("back")}>BACK COVER</button>
              <button type="button" aria-pressed={activeView === "front"} onClick={() => setView("front")}>FRONT DISPLAY</button>
              <button type="button" aria-pressed={activeView === "side"} onClick={() => setView("side")}>SIDE</button>
              <button type="button" aria-pressed={activeView === "angle"} onClick={() => setView("angle")}>ANGLE</button>
              <button type="button" aria-label="Zoom out" onClick={() => zoom(1.2)}><Minus size={13} /></button>
              <button type="button" aria-label="Zoom in" onClick={() => zoom(0.8)}><Plus size={13} /></button>
              <button type="button" aria-label="Reset camera to back cover" onClick={() => setView("back")}><RotateCcw size={13} /></button>
            </div>
        </div>

        <aside className="customizer-controls" aria-label="Laptop skin customization controls">
          <div className="studio-panel-heading"><span>02 / YOUR SETUP</span><Laptop size={17} /></div>
          <span className="control-label">BASE FINISH</span>
          <div className="base-color-options">
            {laptopBaseColors.map((color) => (
              <button
                type="button"
                key={color.value}
                className={baseColor === color.value ? "selected" : ""}
                style={{ "--swatch-color": color.value }}
                onClick={() => setBaseColor(color.value)}
                aria-label={`Set laptop base to ${color.name}`}
                aria-pressed={baseColor === color.value}
              />
            ))}
            <span>{laptopBaseColors.find((color) => color.value === baseColor)?.name}</span>
          </div>

          <div className="selected-skin-summary">
            <span>SELECTED SKIN</span>
            <strong>{selectedSkin.name}</strong>
            <small>{selectedSkin.category} / 14″ LAPTOP VINYL</small>
            <b>₹{selectedSkin.price.toLocaleString("en-IN")}</b>
          </div>

          <button
            type="button"
            className={`customizer-compare ${!showSkin ? "active" : ""}`}
            onClick={() => setShowSkin((shown) => !shown)}
          >
            <span><Sparkles size={15} /> COMPARE ORIGINAL / CUSTOM</span>
            <span>{showSkin ? "CUSTOM" : "ORIGINAL"}</span>
          </button>

          <button
            type="button"
            className="customizer-remove"
            disabled={!showSkin}
            onClick={() => setShowSkin(false)}
          >
            <ArrowLeft size={14} /> REMOVE SKIN
          </button>
          <button type="button" className="customizer-reset" onClick={resetDesign}>
            <RotateCcw size={14} /> RESET DESIGN
          </button>
          <button
            type="button"
            className="button button-lime customizer-add"
            disabled={!showSkin}
            onClick={addDesignToBag}
          >
            {showSkin ? <>ADD CUSTOM SKIN TO BAG <ArrowRight size={15} /></> : "APPLY A DESIGN TO ADD"}
          </button>
          <span className="customizer-note" role="status">{notice || "14″ generic laptop model · Fit varies by device."}</span>
          <a className="customizer-guide-link" href="#collections">EXPLORE THE COLLECTIBLES <ArrowDownRight size={14} /></a>
        </aside>
      </div>
    </section>
  );
}

export default LaptopCustomizer;
