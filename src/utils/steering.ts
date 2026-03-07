/** Steering behaviour helpers — Reynolds-style autonomous motion forces.
 *
 *  All functions are pure: they accept a body snapshot and return a force Vec2
 *  (or force + next-state for wander).  The caller is responsible for applying
 *  the result via `applyForce` from Physics.ts.
 *
 *  No side effects, no class state — fully unit-testable. */

import { vec2Sub, vec2Normalise, vec2Scale, vec2Limit, vec2Len } from '@/utils/vec2';
import type { Vec2 } from '@/utils/vec2';
import type { RigidBody } from '@/types/entities';

/** Seek: steer directly toward target at maxSpeed; clamp to maxForce. */
export const seek = (
  body: Readonly<RigidBody>,
  target: Readonly<Vec2>,
  maxSpeed: number,
  maxForce: number,
): Vec2 => {
  const desired = vec2Scale(vec2Normalise(vec2Sub(target, body.position)), maxSpeed);
  const steering = vec2Sub(desired, body.velocity);
  return vec2Limit(steering, maxForce);
};

/** Flee: steer directly away from threat at maxSpeed; clamp to maxForce. */
export const flee = (
  body: Readonly<RigidBody>,
  threat: Readonly<Vec2>,
  maxSpeed: number,
  maxForce: number,
): Vec2 => {
  const desired = vec2Scale(vec2Normalise(vec2Sub(body.position, threat)), maxSpeed);
  const steering = vec2Sub(desired, body.velocity);
  return vec2Limit(steering, maxForce);
};

/**
 * Arrive: seek with velocity ramp-down inside `slowRadius`.
 * Produces smooth deceleration as the target is approached.
 */
export const arrive = (
  body: Readonly<RigidBody>,
  target: Readonly<Vec2>,
  maxSpeed: number,
  maxForce: number,
  slowRadius: number,
): Vec2 => {
  const toTarget = vec2Sub(target, body.position);
  const dist = vec2Len(toTarget);
  if (dist < 0.5) return { x: 0, y: 0 };
  const speed = dist < slowRadius ? maxSpeed * (dist / slowRadius) : maxSpeed;
  const desired = vec2Scale(toTarget, speed / dist);
  return vec2Limit(vec2Sub(desired, body.velocity), maxForce);
};

/**
 * Wander: project a circle in front of the body, displace a point on it by
 * `wanderJitter` radians each frame.  Produces smooth organic meandering.
 *
 * The caller owns `wanderAngle` state and passes in the previous value;
 * the updated value is returned as `nextWanderAngle`.
 */
export const wander = (
  body: Readonly<RigidBody>,
  wanderAngle: number,
  wanderRadius: number,
  wanderDist: number,
  wanderJitter: number,
  rng: () => number,
  maxForce: number,
): { force: Vec2; nextWanderAngle: number } => {
  const nextAngle = wanderAngle + (rng() - 0.5) * wanderJitter;

  // Project circle centre in current heading direction
  const heading = vec2Normalise(body.velocity);
  const circlePos = vec2Scale(heading, wanderDist);

  const displacement: Vec2 = {
    x: Math.cos(nextAngle) * wanderRadius,
    y: Math.sin(nextAngle) * wanderRadius,
  };

  const target: Vec2 = {
    x: body.position.x + circlePos.x + displacement.x,
    y: body.position.y + circlePos.y + displacement.y,
  };

  return {
    force: vec2Limit(seek(body, target, 100, maxForce), maxForce),
    nextWanderAngle: nextAngle,
  };
};
