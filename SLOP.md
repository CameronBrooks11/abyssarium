Here’s a **weird but actually decent mock project** that will exercise a lot of repo behaviors (UI, commands, docs, rules, scripts) while still being tiny enough for an agent to build quickly.

---

# Project Concept

**Abyssarium — an Ambiguous Creature Tank**

A browser-based “tank” where strange 2D creatures drift around in a simulated liquid environment. The creatures are not explicitly fish—they are vaguely biological shapes that pulse, rotate, swarm, and react to disturbances in the tank.

Users can interact with the tank using controls at the top:

* **Add Food** → drops particles that creatures swarm toward
* **Shake Tank** → simulates turbulence; creatures get tossed around
* **Light Pulse** → flashes light; some creatures hide, others glow
* **Spawn Creature** → randomly generates a new species
* **Catastrophe** → triggers something chaotic (temperature spike, predator event, etc.)

The entire system runs in a single web page.

The point is not realism—it's an **emergent toy ecosystem**.

---

# Core Idea

The tank contains:

* a **fluid simulation layer**
* a **particle layer** (food, bubbles)
* a **creature layer** (agents with simple behavior rules)

Creatures have randomly generated traits like:

* size
* color palette
* movement style
* feeding preference
* aggression

Every creature is procedurally generated.

The tank slowly becomes chaotic as the ecosystem evolves.

---

# Visual Style

Minimalist but lively:

* dark ocean background
* glowing shapes
* soft particle effects
* smooth physics

Creatures look like:

* jellyfish blobs
* abstract plankton
* rotating starfish shapes
* segmented worms
* triangular predators

Think:

**Spore + aquarium screensaver + generative art**

---

# Technical Stack

Keep it extremely simple.

### Frontend

```text
TypeScript
Vite
HTML Canvas 2D
```

No frameworks needed.

Optionally:

```text
Zustand or simple state store
```

But plain modules is fine.

---

### Physics / Simulation

Hand-written lightweight systems:

* simple vector physics
* steering behaviors
* boids-like swarm logic
* particle gravity / buoyancy

No physics engine required.

---

# Repo Structure

```text
abyssarium/
  src/
    main.ts
    tank/
      Tank.ts
      Fluid.ts
      SimulationLoop.ts
    creatures/
      Creature.ts
      CreatureFactory.ts
      behaviors/
        wander.ts
        seekFood.ts
        avoidPredator.ts
    particles/
      Particle.ts
      Food.ts
      Bubble.ts
    systems/
      Renderer.ts
      Physics.ts
      InputSystem.ts
    ui/
      controls.ts
      HUD.ts
  public/
    index.html
  docs/
    concept.md
    ecosystem.md
  scripts/
    build.sh
  tests/
    creature.test.ts
  .github/
    workflows/
      ci.yml
  agent-policy.yaml
```

This gives your agent-policy tool **lots of directories to test rules on**.

---

# Creature Model

Each creature has:

```text
id
species
position
velocity
size
energy
hunger
traits
```

Traits:

```text
speed
curiosity
aggression
glow
foodPreference
```

---

# Behavior System

Every frame:

```
update hunger
seek nearby food
avoid predators
wander randomly
apply turbulence
```

Creatures die if:

```
energy < 0
```

Dead creatures dissolve into particles.

---

# Interaction Buttons

Top toolbar controls:

### Add Food

Drops particles that drift downward.

Creatures move toward them.

---

### Shake Tank

Adds temporary velocity field to all objects.

Everything sloshes around.

---

### Light Pulse

Creates bright flash.

Creatures with `photophobic` trait scatter.

Others glow brighter.

---

### Spawn Creature

Generates a random species.

Example randomization:

```
speed
size
color
movement pattern
behavior weights
```

---

### Catastrophe

Random event:

* predator appears
* toxic bloom
* freezing shock
* oxygen bubble storm

Chaos ensues.

---

# Rendering

Use Canvas.

Each creature draws itself as:

* circles
* triangles
* bezier blobs
* segmented chains

Add subtle glow.

---

# Simulation Loop

```
update physics
update creatures
update particles
render frame
```

Runs via:

```
requestAnimationFrame
```

---

# Example Creature Shapes

You can randomly choose shapes:

```
blob
triangle swarm
rotating star
segmented worm
orb cluster
```

Each species draws differently.

---

# Example Emergent Behavior

After running for a while:

* creatures swarm food clouds
* predators chase plankton
* turbulence scrambles everything
* ecosystems collapse and rebuild

It's basically a **tiny chaotic aquarium toy**.

---

# Commands

Your mock repo can expose commands like:

```text
npm install
npm run dev
npm run build
npm run test
```

Perfect for agent instruction files.

---

# Why This Is a Good Test Project

It gives you:

* realistic repo structure
* UI + logic
* multiple directories
* scripts
* docs
* tests
* interactive demo

And the theme is weird enough that it won’t resemble a real product.

---

# One-line project pitch

**Abyssarium is a chaotic procedural aquarium where strange creatures evolve, swarm, and react to disturbances in a simulated fluid tank.**

---

If you want, I can also give a **very good prompt to hand to an LLM to generate the entire initial project** in one pass so you can immediately start testing your `agent-policy` generator on it.




