# MISSIONMIND 2.0
## Advanced Autonomous Spacecraft Simulator & Multi-Agent Mission Control

**Control the spacecraft. Understand the physics. Trust the data. Collaborate with intelligence.**

MissionMind 2.0 is an aerospace simulation and autonomous mission-control web application combining high-fidelity orbital mechanics, 3-axis thruster dynamics, deployable solar photovoltaic arrays, radar obstacle surveillance, and a 9-agent autonomous intelligence hierarchy.

---

## 🚀 Key Features

### 1. Interactive 3D Spacecraft Simulator
- **Visualizer Engine**: Real-time 3D projected spacecraft simulation showing pressurized command hull, 3-axis thrusters, dual deployable solar panel wings, radar transceiver dome, sensor mast, and gimbaled high-gain dish.
- **Dynamic Propulsion Plumes**: Visual flame exhaust scales with thrust command percentage (-100% to +100%) and color-codes **Chemical Bi-Propellant** (orange/blue) vs **Solar-Electric Ion** (cyan/purple).
- **Interactive Orbit Camera**: Mouse drag to orbit, scroll wheel to zoom. Spacecraft dynamically pitches, yaws, and rolls based on attitude controls.

### 2. Orbital Mechanics Control Centre
- **Central Celestial Bodies**: Real gravitational simulation for **Earth**, **Moon**, **Mars**, and **Sun** with actual astrophysical masses, planetary radii, and surface gravities.
- **Keplerian Trajectory Simulator**:
  - Circular orbital speed: $v_c = \sqrt{GM/r}$
  - Escape velocity: $v_{esc} = \sqrt{2GM/r}$
  - Keplerian orbital period: $T = 2\pi\sqrt{r^3/GM}$
  - Specific orbital energy: $\epsilon = \frac{v^2}{2} - \frac{GM}{r}$
- **Trajectory States**: Distinguishes bound circular orbits, bound elliptical orbits ($0 < e < 1$), parabolic escape boundaries ($\epsilon \approx 0$), and hyperbolic escape trajectories ($\epsilon > 0$).
- **Controls**: Rotary speed slider/knob (m/s & km/s), radius control, inclination slider (0° to 180°), eccentricity control ($0.00$ to $1.40$), and prograde escape burn button.

### 3. Three-Axis Thruster Control System
- **Three Local-Axis Knobs**:
  - **Thruster 1 (X-Axis)**: Fore / Aft translation (-100% to +100%)
  - **Thruster 2 (Y-Axis)**: Port / Starboard translation (-100% to +100%)
  - **Thruster 3 (Z-Axis)**: Dorsal / Ventral translation (-100% to +100%)
- **Euler Local-to-World Translation**: Converts local body thrust commands into world-space acceleration through the 3D rotation matrix:
  $$\vec{a} = \frac{\mathbf{R}(\text{pitch}, \text{yaw}, \text{roll}) \cdot \vec{F}_{\text{local}}}{m}$$
- **Rocket Propulsion Physics**:
  - Propellant mass flow rate: $\dot{m} = \frac{F}{I_{sp} \cdot g_0}$
  - Depletes propellant mass in real time; engines automatically cut off when tanks reach zero.
- **Thermal Dissipation Model**: Thrusters heat up under continuous firing and cool radiatively. Overheat warning and critical shutoff interlocks.
- **Prominent Emergency Cutoff**: Spacebar shortcut immediately cuts all thruster commands to 0% and isolates valves.

### 4. Solar Energy Management & Battery System
- **Deployable Solar Array Wings**: Animated deployment/retraction sequence.
- **Photovoltaic Power Generation**:
  $$P = \eta \cdot A \cdot S \cdot \max(0, \cos\theta)$$
  - High-efficiency multi-junction cells ($\eta = 0.32$, Area $A = 28\text{ m}^2$).
  - Incident solar irradiance $S = 1361\text{ W/m}^2$ at 1 AU with inverse-square distance scaling.
  - Cosine loss tracking with automated sun-vector alignment.
- **60 kWh Flight Battery Pack**: Real-time energy balance $\Delta P = P_{\text{gen}} - P_{\text{load}}$. Charges battery during solar surplus; supplies electrical loads (avionics, life support, science, electric thrusters) during deficit.
- **Propulsion Modes**:
  - **Chemical Propulsion**: 5,000 N max thrust, $I_{sp} = 320\text{ s}$, consumes propellant, zero electrical draw.
  - **Solar-Electric Propulsion**: 250 N max thrust, $I_{sp} = 3,100\text{ s}$, requires up to 4,500 W of electrical power from solar arrays and battery reserves.
  - **Hybrid Energy Mode**: Automatic load balancing for cruise efficiency.

### 5. Radar Surveillance & Obstacle Detection
- **360° Circular Sweep Screen**: Real-time rotating radar beam with phosphor decay trail.
- **Contact Tracking**: Tracks space debris, asteroids, orbital probes, and unknown contacts.
- **Relative Astrodynamics**:
  - Relative position: $\vec{r}_{rel} = \vec{r}_{obj} - \vec{r}_{sc}$
  - Relative velocity: $\vec{v}_{rel} = \vec{v}_{obj} - \vec{v}_{sc}$
  - Time of Closest Approach (TCA):
    $$t_{CA} = -\frac{\vec{r}_{rel} \cdot \vec{v}_{rel}}{|\vec{v}_{rel}|^2}$$
  - Miss distance at TCA:
    $$d_{CA} = |\vec{r}_{rel} + \vec{v}_{rel} \cdot t_{CA}|$$
- **Alert Levels**:
  - 🟢 **Green (Safe)**: $d_{CA} > 12\text{ km}$ or diverging ($t_{CA} \le 0$).
  - 🟡 **Yellow (Tracking)**: $2.5\text{ km} < d_{CA} \le 12\text{ km}$ within 6 minutes.
  - 🔴 **Red (Collision Warning)**: $d_{CA} \le 2.5\text{ km}$ within 3 minutes.
- **Interactive Inspector**: Change radar range (25, 50, 150, 500 km), inspect individual targets, toggle radar sweep.

### 6. Sensor Monitoring Dashboard
Live telemetry from 7 simulated sensor suites with thresholds, units, and sparkline mini-graphs:
1. **Tri-Axial Inertial Accelerometer** ($a_x, a_y, a_z, |a|$ in $\text{m/s}^2$)
2. **Optical Ring-Laser Gyroscope** (pitch, yaw, roll rates in $\text{deg/s}$)
3. **Deep-Space LIDAR & Ranging Array** (altitude and closest target in $\text{km}$)
4. **Multi-Zone Thermal Radiometer** (cabin, hull, thruster, battery in $^\circ\text{C}$)
5. **Silicon Dosimetric Radiation Sensor** (flux in $\mu\text{Sv/h}$, cumulative $\text{mSv}$)
6. **Solar Flux & Pyranometer Spectrometer** (irradiance $\text{W/m}^2$, exposure %, angle)
7. **Capacitive Propellant Quantity Sensor** (remaining mass $\text{kg}$, flow rate $\text{kg/s}$)

### 7. Nine Specialized Autonomous AI Agents
1. **Commander Agent (CMD)**: Central mission coordination, arbitration, and final decision authority.
2. **Navigation Agent (NAV)**: Orbital mechanics, Keplerian elements, Hohmann transfers, and escape burns.
3. **Fuel Management Agent (FUEL)**: Propellant inventory, flow rate accounting, and leak containment.
4. **Risk Assessment Agent (RISK)**: Multi-system risk index (0–100) and cascading failure detection.
5. **Systems & Life Support Agent (SYS)**: Cabin atmosphere, oxygen generation, and hull integrity.
6. **Science Agent (SCI)**: Spectroscopy, planetary observations, and research payload scheduling.
7. **Energy Transition Agent (ENGY)**: Manages chemical vs solar-electric propulsion transitions.
8. **Proximity Detection Agent (PROX)**: Analyzes radar tracks, computes TCA, and executes collision avoidance burns.
9. **Propulsion Control Agent (PROP)**: 3-axis thruster balancing, flow validation, and thermal protection.

### 8. Physics Laboratory (15 Live Calculations)
Displays real-time equations, substituted simulation values, evaluated answers, and SI units:
1. Universal Gravitational Force: $F = G \frac{M m}{r^2}$
2. Gravitational Acceleration: $g = G \frac{M}{r^2}$
3. Circular Orbital Velocity: $v_c = \sqrt{\frac{G M}{r}}$
4. Central Body Escape Velocity: $v_{esc} = \sqrt{\frac{2 G M}{r}}$
5. Keplerian Orbital Period: $T = 2\pi \sqrt{\frac{r^3}{G M}}$
6. Specific Orbital Energy: $\epsilon = \frac{v^2}{2} - \frac{G M}{r}$
7. Total Kinetic Energy: $E_k = \frac{1}{2} m v^2$
8. Gravitational Potential Energy: $U = -\frac{G M m}{r}$
9. Acceleration from Thrust: $a = \frac{F_{total}}{m}$
10. Propellant Mass Flow Rate: $\dot{m} = \frac{F}{I_{sp} \cdot g_0}$
11. Photovoltaic Power Generation: $P = \eta A S \cos(\theta)$
12. Battery Energy Balance: $\Delta P = P_{solar} - P_{load}$
13. Relative Velocity: $v_{rel} = |\vec{v}_{obj} - \vec{v}_{sc}|$
14. Closest Approach Distance: $d_{CA} = |\vec{r}_{rel} + \vec{v}_{rel} \cdot t_{CA}|$
15. Spacecraft Linear Momentum: $p = m \cdot v$

### 9. Operating Flight Modes & Authority Matrix
- **MANUAL MODE**: Direct user control via keyboard (W/S/A/D/R/F/Q/E/Space) and rotary knobs. Autonomous agents monitor and report, but cannot override user inputs.
- **AUTONOMOUS MODE**: The 9 agents analyze telemetry, coordinate via the message bus, and autonomously execute flight maneuvers.
- **HYBRID MODE**: Configurable authority matrix where the user controls designated subsystems (e.g., Thrusters, Orientation) while autonomous agents manage other systems (e.g., Solar, Navigation).

---

## ⌨️ Flight Keybindings

| Key | Function |
|---|---|
| **W** | +X Axis Thruster (Forward / Prograde) |
| **S** | -X Axis Thruster (Aft / Retrograde) |
| **A** | +Y Axis Thruster (Port Lateral) |
| **D** | -Y Axis Thruster (Starboard Lateral) |
| **R** | +Z Axis Thruster (Dorsal Up) |
| **F** | -Z Axis Thruster (Ventral Down) |
| **Q** | Rotate Left / Roll Counter-Clockwise |
| **E** | Rotate Right / Roll Clockwise |
| **Space** | **EMERGENCY THRUSTER CUTOFF** |

---

## 📁 Technical Architecture

```
MissionMind/
│
├── index.html                   # Master entry point with 11 navigation views
├── README.md                    # System documentation and physics reference
├── LICENSE                      # MIT Open Source License
│
├── css/
│   ├── style.css                # Core design system & typography
│   ├── dashboard.css            # Mission control layout & cards
│   ├── controls.css             # Rotary knobs, bipolar sliders & cockpit HUD
│   ├── radar.css                # Circular radar scope & target inspector
│   ├── agents.css               # AI agent cards & message stream
│   └── responsive.css           # Mobile & tablet viewports
│
├── js/
│   ├── app.js                   # Application bootstrap & view coordination
│   ├── config.js                # Astrophysical constants & system specifications
│   ├── mission-state.js         # Single authoritative spacecraft state
│   ├── simulation-engine.js     # Master clock & progression loop
│   │
│   ├── simulation/
│   │   ├── physics-engine.js    # Newton, Kepler & SI astrophysics formulation
│   │   ├── orbital-engine.js    # Orbital elements, central bodies & trajectory
│   │   ├── spacecraft-engine.js # 3-axis thruster dynamics, F=ma, Euler attitude
│   │   ├── energy-engine.js     # Solar generation, battery integral & loads
│   │   ├── sensor-engine.js     # 7 sensor telemetry suites & rolling history
│   │   └── radar-engine.js      # Target tracking, TCA & proximity calculations
│   │
│   ├── agents/
│   │   ├── base-agent.js        # Base agent class & report schema
│   │   ├── commander-agent.js   # Central coordinator & decision engine
│   │   ├── navigation-agent.js  # Orbital mechanics & escape burns
│   │   ├── fuel-agent.js        # Propellant reserves & mass accounting
│   │   ├── risk-agent.js        # Composite risk scoring (0-100)
│   │   ├── systems-agent.js     # Life support, O2 & cabin atmosphere
│   │   ├── science-agent.js     # Spectroscopy & deep-space observation
│   │   ├── energy-agent.js      # Chemical vs Solar-Electric propulsion transition
│   │   ├── proximity-agent.js   # Radar track assessment & collision avoidance
│   │   └── propulsion-agent.js  # 3-axis thruster balancing & thermal limits
│   │
│   ├── core/
│   │   ├── control-manager.js   # Flight authority (Manual/Auto/Hybrid) & keys
│   │   ├── agent-manager.js     # 9-agent deliberation loop
│   │   ├── decision-engine.js   # Action catalog, validation & execution
│   │   ├── message-bus.js       # Pub-sub message dispatch
│   │   ├── event-manager.js     # Emergency scenarios lifecycle
│   │   └── utils.js             # Formatting, math clamps & helpers
│   │
│   └── ui/
│       ├── dashboard.js         # Mission control overview & navigation
│       ├── spacecraft-view.js   # 3D interactive spacecraft simulator
│       ├── orbital-controls.js  # Keplerian orbital controls & trajectory plot
│       ├── thruster-controls.js # 3 bipolar rotary knobs & emergency cutoff
│       ├── solar-panel-controls.js # Solar wing deployment & battery HUD
│       ├── radar-display.js     # Circular animated radar scope & inspector
│       ├── sensor-display.js    # 7-sensor telemetry cards with sparklines
│       ├── physics-lab.js       # 15 real-time astrophysics calculations
│       ├── agent-cards.js       # Agent cards & structured report dialogs
│       ├── telemetry.js         # Chart.js analytics & flight graphs
│       └── decision-log.js      # Traceable decision history & exports
```

---

## 💻 Local Execution Instructions

MissionMind 2.0 has zero backend or build tool requirements. It runs completely client-side in any modern web browser.

### Option 1: Direct Browser Launch
1. Navigate to the project directory.
2. Double-click `index.html` to open it in Chrome, Edge, Firefox, or Safari.

### Option 2: Local HTTP Server (Recommended)
Running through a local web server ensures seamless loading of all font and CDN assets:

```bash
# Using Python 3 (if installed)
python -m http.server 8000

# Using Node.js npx (if installed)
npx serve .

# Or using VS Code Live Server extension:
# Right-click index.html -> "Open with Live Server"
```
Then navigate to `http://localhost:8000`.

---

## 🌐 Deployment Instructions

### Deploy to GitHub Pages
1. Initialize or push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: complete MissionMind 2.0 release"
   git branch -M main
   git remote add origin https://github.com/<your-username>/missionmind.git
   git push -u origin main
   ```
2. In your GitHub repository, open **Settings** > **Pages**.
3. Under **Build and deployment**, select **Source: Deploy from a branch**.
4. Choose the `main` branch and `/ (root)` folder, then click **Save**.
5. Your MissionMind 2.0 simulation will be live at `https://<your-username>.github.io/missionmind/`.

### Deploy to Netlify
1. Drag and drop the project folder directly into the [Netlify Drop](https://app.netlify.com/drop) dashboard.
2. Or link your GitHub repository to Netlify:
   - **Build command**: *(leave blank)*
   - **Publish directory**: `.` *(current directory)*
3. Netlify will deploy MissionMind 2.0 in seconds with automated HTTPS.

---

## 📜 License
MissionMind 2.0 is licensed under the [MIT License](LICENSE).
