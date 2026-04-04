# Root Cause Analysis: Circumcenter != Moon Center — JPL Ephemeris Fix

**Date**: 2026-04-05
**Severity**: High
**Status**: Identified — DEFINITIVE (7th investigation)

## Root Cause

The circumcenter algorithm computes the center of the osculating circle of the trajectory arc — a geometric construct that is NOT the gravitational focus (Moon center). For hyperbolic flybys, these differ by ~5,034 km. The circumcenter is only 3,002 km from the trajectory, making clipping inevitable. The real Moon center (from JPL Horizons) is 8,357 km from the trajectory — safe for any practical sphere size.

## Resolution

Replace the circumcenter algorithm with bundled JPL Horizons ephemeris data (37 geocentric J2000 points covering April 2-11 2026). Interpolate Moon position at current simulation time. Both bodies at 2.0x real scale (Earth 1.274 su, Moon 0.347 su).
