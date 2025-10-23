import * as THREE from 'three';

// ==========================
// Constants — Easy Tweaking
// ==========================
// Units & scaling
// Scale real KM to scene units (keeps numbers in a reasonable range). 10,000,000 km => 1 scene unit.
export const KM_TO_SCENE = 1 / 1e7;

// Trail rendering
// Maximum alpha (opacity) for the newest point in a trail.
export const TRAIL_MAX_ALPHA = 0.85;
// Exponent for ease-in alpha ramp along trail (2 = quadratic ease-in).
export const TRAIL_EASE_EXPONENT = 3;
export const TRAIL_NEAR_BODY_DIAMETERS = 2;
export const TRAIL_NEAR_BODY_FADE_EXPONENT = 3;

// Apparent size scaling (for visual clarity vs physical accuracy)
// Base scaling factor for all celestial body radii on screen.
export const CBODY_RADIUS_MULTIPLIER = 0.05;
// Nonlinear compression exponent to reduce giant/dwarf disparities relative to Earth.
export const SIZE_EXPONENT = 0.6;
// Minimum ratio clamp to prevent degenerate sizes when numbers are tiny.
export const MIN_SCALE_RATIO = 1e-6;

// Orbit layout
// Exaggerate separation of moons from their parent to avoid overlap with non-physical display radii.
export const ORBIT_OFFSET_MULTIPLIER = 30;

// Camera and orbit behavior
// Max elevation angle away from the orbital plane (~63 degrees).
export const MAX_PITCH_RAD = 1.1;
// Default camera radius (zoom) from the orbit center (user position).
export const ORBIT_INITIAL_RADIUS = 0.1;
// Default yaw angle at start.
export const ORBIT_INITIAL_YAW = 2;
// Initial height as a fraction of the radius; pitch starts at asin of this value.
export const ORBIT_DEFAULT_HEIGHT_RATIO = 0;
// Idle autorotation speed (radians per frame) when user is not interacting.
export const AUTO_ROTATE_YAW_SPEED = 0.001;
// Smoothing factors for tweening toward target yaw/pitch/radius.
export const SMOOTHING_YAW = 0.15;
export const SMOOTHING_PITCH = 0.18;
export const SMOOTHING_RADIUS = 0.2;

// For very short travels (e.g., Mars -> Phobos), lock camera yaw to side-on during the
// travel animation to avoid ending up behind the parent body. Units are scene units.
export const YAW_SIDE_ON_DISTANCE_CUTOFF = 0.3;

// Gesture settings
// Min/max zoom radius for pinch gesture.
export const ZOOM_MIN_RADIUS = 0.05;
export const ZOOM_MAX_RADIUS = 20000;
// Drag across full screen width rotates yaw by 360°, across height rotates pitch by 180°.
export const PAN_YAW_ROTATION_PER_FULL_DRAG = 2 * Math.PI;
export const PAN_PITCH_ROTATION_PER_FULL_DRAG = Math.PI;
// Approximate frames per second used to convert gesture velocity (px/s) to per-frame values.
export const INERTIA_FRAMES_PER_SECOND = 60;
// Clamp for inertial yaw/pitch velocity after pan end.
export const YAW_VELOCITY_CLAMP = 0.2;
export const PITCH_VELOCITY_CLAMP = 0.15;
// Friction factor applied to inertial velocities each frame.
export const INERTIA_FRICTION = 0.92;
// Threshold below which inertial velocities are snapped to zero.
export const INERTIA_STOP_EPSILON = 1e-6;

// Renderer & scene
// Clear color for the WebGL renderer.
export const RENDERER_CLEAR_COLOR = 0x101018;
// Clear alpha for the renderer background.
export const RENDERER_CLEAR_ALPHA = 1;
// Pixel ratio for the renderer (1 keeps things predictable across devices in GLView).
export const RENDERER_PIXEL_RATIO = 1;
// MSAA samples for GLView; 0 disables to avoid unsupported configurations on some devices.
export const GL_MSAA_SAMPLES = 0;
// Camera projection parameters.
export const CAMERA_FOV = 60;
export const CAMERA_NEAR = 0.01;
export const CAMERA_FAR = 20000;

// Lighting
// Low ambient to keep space dark while detailing planet shading.
export const AMBIENT_LIGHT_INTENSITY = 0.75;
// Sun light intensity, infinite distance (0) and mild decay for falloff.
export const SUNLIGHT_INTENSITY = 6;
export const SUNLIGHT_DISTANCE = 0;
export const SUNLIGHT_DECAY = 0.1;

// Sky dome
// Radius and segments of the inverted sphere used as the starfield backdrop.
export const SKY_SPHERE_RADIUS = 1800;
export const SKY_SEGMENTS = 48;
export const SKY_BRIGHTNESS = 8;

// Geometry quality
// Number of segments used for planet spheres.
export const SPHERE_SEGMENTS = 24;

// Material/texture knobs
// Anisotropic filtering for textures (improves sharpness at glancing angles).
export const TEXTURE_ANISOTROPY = 4;

// Mesh orientation
// Rotate planet meshes so their equators are horizontal and textures align nicely.
export const PLANET_MESH_X_ROTATION = -Math.PI / 2;
// (Removed continuous spin; we keep a static random phase.)

// Numerics
// Squared-length threshold to detect near-degenerate plane normals.
export const PLANE_NORMAL_EPS = 1e-8;
// Threshold when choosing a helper axis for cross products (avoid near-parallel vectors).
export const HELPER_AXIS_THRESHOLD = 0.9;
// Global ecliptic "up" direction (J2000 heliocentric ecliptic uses +Z as north)
export const ECLIPTIC_UP = new THREE.Vector3(0, 0, 1);

// Post-processing outline
// Controls for the OutlinePass used to accent selected meshes.
export const OUTLINE_EDGE_STRENGTH = 1.5;
export const OUTLINE_EDGE_GLOW = 1.0;
export const OUTLINE_EDGE_THICKNESS = 1.0;
export const OUTLINE_PULSE_PERIOD = 0.0;

// Outline LOD & fading
// Fade outlines based on screen-space radius (in pixels). Below FADE_OUT -> 0, above FADE_IN -> 1.
export const OUTLINE_MIN_PIXELS_FADE_OUT = 8; // start fading in around this size
export const OUTLINE_MIN_PIXELS_FADE_IN = 14; // fully visible by this size
// Smoothing for outline intensity changes (per-frame lerp factor)
export const OUTLINE_INTENSITY_SMOOTHING = 0.15;
// Below this intensity, disable the pass to avoid any processing cost
export const OUTLINE_MIN_ENABLED_FACTOR = 0.02;

// Rocket model controls
export const ROCKET_MODEL_SCALE = 0.01; // uniform scale for OBJ model
export const ROCKET_SPIN_SPEED = 0.03; // radians per frame while traveling
export const DEFAULT_ROCKET_FORWARD = new THREE.Vector3(0, 1, 0); // assumed model forward axis
// Additional fixed clearance applied at destination to avoid intersecting surface (scene units)
export const ROCKET_LANDING_CLEARANCE = 0.005;

export const TRAIL_LENGTH_MULTIPLIER = 0.5;

// Overall scale for rocket exhaust visuals: affects sprite size and travel distance
export const ROCKET_EXHAUST_SCALE = 0.5;

// Animation durations (ms)
export const HABIT_TRAVEL_ANIM_MS = 5000; // duration for visual travel per completion
export const CAMERA_MOVE_MS = 2000; // camera move into starting vantage
export const CAMERA_HOLD_MS = 500; // hold before rocket animation begins
