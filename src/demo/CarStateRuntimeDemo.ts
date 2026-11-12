/**
 * CarStateRuntimeDemo.ts
 *
 * Demonstrates strict architectural separation:
 * 1. STATE TREE: Pure MobX classes (CarState, SteeringState, TireState)
 *    - Contains ONLY domain specs, transforms, visibility, material channels, computed properties.
 *    - ZERO references to THREE.Mesh or WebGL.
 *    - 100% serializable via MobX toJS().
 *
 * 2. RUNTIME ENGINE: Sole Owner of Three.js Objects (Car3DRuntime)
 *    - Watches MobX state changes reactively.
 *    - Creates, updates, and disposes THREE.Mesh (Boxes and Spheres/Cylinders).
 *    - Reconciles additions, removals (e.g. steering = null), and replacements.
 */

import { makeAutoObservable, reaction, toJS, autorun } from "mobx";
import * as THREE from "three";

// ============================================================================
// 1. PURE MOBX STATE CLASSES (No Three.js Mesh references, completely serializable)
// ============================================================================

export interface TransformState {
  x: number;
  y: number;
  z: number;
}

export interface MaterialChannelState {
  color: string;
  roughness: number;
  metalness: number;
}

/**
 * Steering State: Represents a singular child of Car
 */
export class SteeringState {
  id: string;
  power: string; // e.g., '5hp', '10hp'
  visible: boolean = true;
  transform: TransformState = { x: 0, y: 1.0, z: 0.8 };
  material: MaterialChannelState = { color: "#38bdf8", roughness: 0.4, metalness: 0.2 };

  constructor(id: string, power: string, color: string = "#38bdf8") {
    this.id = id;
    this.power = power;
    this.material.color = color;
    makeAutoObservable(this);
  }

  // Computed function: radius calculated from power spec
  get radius(): number {
    return this.power.includes("10hp") ? 0.35 : 0.25;
  }
}

/**
 * Tire State: Represents an element inside tires array
 */
export class TireState {
  id: string;
  side: "front-left" | "front-right" | "rear-left" | "rear-right";
  visible: boolean = true;
  radius: number = 0.4;
  width: number = 0.25;
  transform: TransformState;
  material: MaterialChannelState = { color: "#1e293b", roughness: 0.9, metalness: 0.1 };

  constructor(id: string, side: "front-left" | "front-right" | "rear-left" | "rear-right") {
    this.id = id;
    this.side = side;

    // Computed default position based on axle side
    const x = side.includes("left") ? -1.0 : 1.0;
    const z = side.includes("front") ? 1.2 : -1.2;
    this.transform = { x, y: 0.4, z };

    makeAutoObservable(this);
  }

  // Computed property: wheel track offset
  get trackOffset(): number {
    return this.transform.x;
  }
}

/**
 * Car State: Parent Composite
 */
export class CarState {
  id: string;
  chassisColor: string = "#00f2fe";
  visible: boolean = true;

  // Single Part Slot (can be null or SteeringState)
  steering: SteeringState | null = null;

  // Array Part Slot
  tires: TireState[] = [];

  constructor(id: string) {
    this.id = id;
    makeAutoObservable(this);
  }

  // State actions (pure data mutations)
  setSteering(power: string | null, color?: string) {
    if (!power) {
      this.steering = null;
    } else {
      this.steering = new SteeringState(`steering_${Date.now()}`, power, color);
    }
  }

  setTires(sides: Array<"front-left" | "front-right" | "rear-left" | "rear-right">) {
    this.tires = sides.map((side, i) => new TireState(`tire_${i}_${side}`, side));
  }
}

// ============================================================================
// 2. RUNTIME ENGINE (The SOLE Owner of Three.js Objects & Lifecycles)
// ============================================================================

export class Car3DRuntime {
  public scene: THREE.Scene;
  public carGroup: THREE.Group;

  // Internal Runtime Mesh mappings (State Object -> Three.js Mesh)
  private chassisMesh: THREE.Mesh | null = null;
  private steeringMesh: THREE.Mesh | null = null;
  private tireMeshMap: Map<TireState, THREE.Mesh> = new Map();

  private disposers: Array<() => void> = [];

  constructor(public state: CarState, targetScene?: THREE.Scene) {
    this.scene = targetScene || new THREE.Scene();
    this.carGroup = new THREE.Group();
    this.carGroup.name = `CarGroup_${state.id}`;
    this.scene.add(this.carGroup);

    this.bindReactivity();
  }

  /**
   * Bind MobX reactions to observe the pure state and update Three.js meshes
   */
  private bindReactivity() {
    // A. Reconcile Chassis (Box)
    const d1 = autorun(() => {
      this.syncChassis();
    });
    this.disposers.push(d1);

    // B. Reconcile Steering (Sphere/Cylinder) on assignment or removal (car.steering = null / new SteeringState)
    const d2 = reaction(
      () => this.state.steering,
      (currentSteering, prevSteering) => {
        this.syncSteering(currentSteering, prevSteering);
      },
      { fireImmediately: true }
    );
    this.disposers.push(d2);

    // C. Reconcile Tires Array on assignment (car.tires = [...])
    const d3 = reaction(
      () => [...this.state.tires],
      (currentTires) => {
        this.syncTires(currentTires);
      },
      { fireImmediately: true }
    );
    this.disposers.push(d3);
  }

  // --- Runtime Mesh Builders & Updaters ---

  private syncChassis() {
    if (!this.chassisMesh) {
      // Create Chassis Box
      const geo = new THREE.BoxGeometry(1.8, 0.6, 3.2);
      const mat = new THREE.MeshStandardMaterial({ color: this.state.chassisColor, metalness: 0.5, roughness: 0.3 });
      this.chassisMesh = new THREE.Mesh(geo, mat);
      this.chassisMesh.name = "Chassis_Mesh";
      this.chassisMesh.position.set(0, 0.5, 0);
      this.carGroup.add(this.chassisMesh);
      console.log("[Runtime] 📦 Created Chassis Mesh (Box)");
    } else {
      // Update material channel without rebuilding geometry
      (this.chassisMesh.material as THREE.MeshStandardMaterial).color.set(this.state.chassisColor);
    }
  }

  private syncSteering(current: SteeringState | null, previous?: SteeringState | null) {
    // 1. If previous exists and is removed/replaced -> Cleanly dispose Three.js mesh
    if (this.steeringMesh) {
      this.carGroup.remove(this.steeringMesh);
      this.disposeObject3D(this.steeringMesh);
      this.steeringMesh = null;
      console.log("[Runtime] 🗑️ Disposed old Steering Mesh from 3D Scene");
    }

    // 2. If new steering state is assigned -> Build new Three.js mesh (Sphere/Torus)
    if (current) {
      const geo = new THREE.SphereGeometry(current.radius, 16, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: current.material.color,
        roughness: current.material.roughness,
        metalness: current.material.metalness
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `Steering_${current.id}`;
      mesh.position.set(current.transform.x, current.transform.y, current.transform.z);
      this.steeringMesh = mesh;
      this.carGroup.add(mesh);
      console.log(`[Runtime] 🎯 Built Steering Mesh (Sphere, radius: ${current.radius}, power: ${current.power})`);
    }
  }

  private syncTires(currentTires: TireState[]) {
    // 1. Find removed tires and dispose their Three.js meshes
    for (const [tireState, mesh] of this.tireMeshMap.entries()) {
      if (!currentTires.includes(tireState)) {
        this.carGroup.remove(mesh);
        this.disposeObject3D(mesh);
        this.tireMeshMap.delete(tireState);
        console.log(`[Runtime] 🗑️ Disposed Tire Mesh for side: ${tireState.side}`);
      }
    }

    // 2. Add or maintain meshes for active tires
    for (const tireState of currentTires) {
      if (!this.tireMeshMap.has(tireState)) {
        // Build Tire Cylinder/Sphere
        const geo = new THREE.CylinderGeometry(tireState.radius, tireState.radius, tireState.width, 24);
        geo.rotateZ(Math.PI / 2); // Orient as wheel
        const mat = new THREE.MeshStandardMaterial({
          color: tireState.material.color,
          roughness: tireState.material.roughness,
          metalness: tireState.material.metalness
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = `Tire_${tireState.side}`;
        mesh.position.set(tireState.transform.x, tireState.transform.y, tireState.transform.z);

        this.carGroup.add(mesh);
        this.tireMeshMap.set(tireState, mesh);
        console.log(`[Runtime] 🛞 Built Tire Mesh for side: ${tireState.side} at [${tireState.transform.x}, ${tireState.transform.y}, ${tireState.transform.z}]`);
      }
    }
  }

  private disposeObject3D(obj: THREE.Mesh) {
    if (obj.geometry) {
      obj.geometry.dispose();
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  }

  public dispose() {
    this.disposers.forEach(d => d());
    this.disposers = [];
    if (this.chassisMesh) this.disposeObject3D(this.chassisMesh);
    if (this.steeringMesh) this.disposeObject3D(this.steeringMesh);
    for (const mesh of this.tireMeshMap.values()) {
      this.disposeObject3D(mesh);
    }
    this.tireMeshMap.clear();
    this.scene.remove(this.carGroup);
  }
}

// ============================================================================
// 3. EXECUTION DEMO
// ============================================================================

export function runDemo() {
  console.log("=================================================================");
  console.log("🚀 STARTING CAR STATE -> RUNTIME THREE.JS SEPARATION DEMO");
  console.log("=================================================================\n");

  // Step 1: Create pure state tree (No meshes)
  const carState = new CarState("car_001");

  // Step 2: Initialize Runtime (Pass state to runtime)
  const runtime = new Car3DRuntime(carState);

  console.log("\n--- [Step 1] Loading initial tires from fetched state ---");
  carState.setTires(["front-left", "front-right", "rear-left", "rear-right"]);
  console.log(`Three.js carGroup children count: ${runtime.carGroup.children.length}`);

  console.log("\n--- [Step 2] User assigns steering spec: car.steering = { power: '5hp' } ---");
  carState.setSteering("5hp", "#38bdf8");
  console.log(`Three.js carGroup children count: ${runtime.carGroup.children.length}`);

  console.log("\n--- [Step 3] Pure MobX toJS() snapshot (Clean for Database) ---");
  const dbSnapshot = toJS({
    id: carState.id,
    chassisColor: carState.chassisColor,
    steering: carState.steering ? { power: carState.steering.power, color: carState.steering.material.color } : null,
    tires: carState.tires.map(t => ({ side: t.side, radius: t.radius }))
  });
  console.log("Database Clean JSON Payload:\n", JSON.stringify(dbSnapshot, null, 2));

  console.log("\n--- [Step 4] User removes steering: car.steering = null ---");
  carState.setSteering(null);
  console.log(`Three.js carGroup children count: ${runtime.carGroup.children.length}`);

  console.log("\n--- [Step 5] User replaces tires with only 2 front tires ---");
  carState.setTires(["front-left", "front-right"]);
  console.log(`Three.js carGroup children count: ${runtime.carGroup.children.length}`);

  console.log("\n--- [Step 6] User equips upgraded 10hp steering ---");
  carState.setSteering("10hp", "#f43f5e");
  console.log(`Three.js carGroup children count: ${runtime.carGroup.children.length}`);

  console.log("\n=================================================================");
  console.log("✅ DEMO FINISHED SUCCESSFULLY: State remains 100% pure JSON,");
  console.log("   while Runtime cleanly manages all Three.js meshes & memory.");
  console.log("=================================================================");
}
