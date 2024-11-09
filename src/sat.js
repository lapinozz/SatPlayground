import Vec from './utils/vec';

class Overlap
{
	constructor(min, max)
	{
		this.min = min;
		this.max = max;
	}

	doesOverlap(other)
	{
		return !(this.min >= other.max || other.min >= this.max);
	}

	getOverlap(other)
	{
		if(!this.doesOverlap(other))
		{
			return 0;
		}

		if (this.min < other.min)
		{
			if (this.max < other.max)
			{
				return this.max - other.min;
			}
			else
			{
				const option1 = this.max - other.min;
				const option2 = other.max - this.min;
				return option1 < option2 ? option1 : -option2;
			}
		}
		else
		{
			if (this.max > other.max)
			{
				return this.min - other.max;
			}
			else
			{
				const option1 = this.max - other.min;
				const option2 = other.max - this.min;
				return option1 < option2 ? option1 : -option2;
			}
		}	
	}

	getDistance(other)
	{
		if(this.doesOverlap(other))
		{
			return 0;
		}

		return -Math.min(
			Math.abs(this.min - other.min),
			Math.abs(this.min - other.max),
			Math.abs(this.max - other.min),
			Math.abs(this.max - other.max),
		);
	}
}

function getAxes(polygon)
{
	const axes = [];
	const pts = polygon.getAbsolutePoints();
	for(let x = 0; x < pts.length; x++)
	{
		const a = pts[x];
		const b = pts[(x + 1) % pts.length];
		axes.push({
			a, b,
			normal: b.sub(a).perp().normalize(),
			color: polygon.getColor(),
			poly: polygon
		});
	}
	return axes;
}

export function project(axis, polygon, vel)
{
	const pts = polygon.getAbsolutePoints();
	let min = axis.dot(pts[0]);
	let max = min;
	for(let x = 1; x < pts.length; x++)
	{
		const p = axis.dot(pts[x]);
		min = Math.min(p, min);
		max = Math.max(p, max);
	}

	return new Overlap(min, max);
}

function best(polygon, mtv)
{
	// step 1
	// find the farthest vertex in
	// the polygon along the separation normal

	const pts = polygon.getAbsolutePoints();
	let bestIndex;
	let max = -Infinity;
	for (let i = 0; i < pts.length; i++)
	{
	  const projection = mtv.dot(pts[i]);
	  if (projection > max)
	  {
	    max = projection;
	    bestIndex = i;
	  }
	}

	// step 2
	// now we need to use the edge that
	// is most perpendicular, either the
	// right or the left
	const v = pts[bestIndex];
	const v1 = pts[(bestIndex - 1 + pts.length) % pts.length];
	const v0 = pts[(bestIndex + 1) % pts.length];

	const l = v.sub(v1).normalize();
	const r = v.sub(v0).normalize();

	// the edge that is most perpendicular
	// to n will have a dot product closer to zero
	if (r.dot(mtv) <= l.dot(mtv))
	{
		// the right edge is better
		// make sure to retain the winding direction
		const e = v.sub(v0);
		return {max: v, a: v0, b: v, e};
	}
	else
	{
		// the left edge is better
		// make sure to retain the winding direction
		const e = v1.sub(v);
		return {max: v, a: v, b: v1, e};
	}
}

// clips the line segment points v1, v2
// if they are past o along n
function clipPoints(v1, v2, n, o)
{
  const d1 = n.dot(v1) - o;
  const d2 = n.dot(v2) - o;

  const cp = [];

  // if either point is past o along n
  // then we can keep the point
  if (d1 >= 0.0) cp.push(v1);
  if (d2 >= 0.0) cp.push(v2);
  // finally we need to check if they
  // are on opposing sides so that we can
  // compute the correct point
  if (d1 * d2 < 0.0) {
    // if they are on different sides of the
    // offset, d1 and d2 will be a (+) * (-)
    // and will yield a (-) and therefore be
    // less than zero
    // get the vector for the edge we are clipping
    const e = v2.sub(v1);
    // compute the location along e
    const u = d1 / (d1 - d2);
    cp.push(e.mul(u).add(v1));
  }

  return cp;
}

function findCollisionPoints(a, b, mtv, filterPoints = true)
{
	// find the "best" edge for shape A
	let ref = best(a, mtv.normal);
	// find the "best" edge for shape B
	let inc = best(b, mtv.normal.neg());

	let flip = false;
	if (Math.abs(ref.e.dot(mtv.normal)) > Math.abs(inc.e.dot(mtv.normal)))
	{
		[ref, inc] = [inc, ref];
		flip = true;
	}
	flip = flip != mtv.poly == a;

	const refv = ref.e.normalize();

	let cp = [inc.a, inc.b];
	let result = {refFace: ref, incFace: inc, contacts: []};

	const o1 = refv.dot(ref.a);
	// clip the incident edge by the first
	// vertex of the reference edge
	cp = clipPoints(cp[0], cp[1], refv, o1);
	// if we dont have 2 points left then fail
	if (cp.length < 2)
	{
		return result;
	}

	// clip whats left of the incident edge by the
	// second vertex of the reference edge
	// but we need to clip in the opposite direction
	// so we flip the direction and offset
	const o2 = refv.dot(ref.b);
	cp = clipPoints(cp[0], cp[1], refv.neg(), -o2);
	// if we dont have 2 points left then fail
	if (cp.length < 2)
	{
		return result;
	}

	// get the reference edge normal
	let refNorm = ref.e.perp();
	// if we had to flip the incident and reference edges
	// then we need to flip the reference edge normal to
	// clip properly
	if (!flip)
	{
		refNorm = refNorm.neg();
	}

	if(filterPoints)
	{
		// get the largest depth
		const max = refNorm.dot(ref.max);

		// make sure the final points are not past this maximum
		if (refNorm.dot(cp[1]) - max < 0)
		{
		  cp.splice(1, 1);
		}

		if (refNorm.dot(cp[0]) - max < 0)
		{
		  cp.splice(0, 1);
		}
	}

	return {...result, contacts: cp};
}

export default class Sat 
{
	static test(a, b)
	{
		const axes = [...getAxes(a), ...getAxes(b)];

		let collide = true;

		let mtv = null;

		for(const axis of axes)
		{
			const p1 = project(axis.normal, a);
			const p2 = project(axis.normal, b);

			axis.p1 = p1;
			axis.p2 = p2;
			axis.overlap = p1.getOverlap(p2);

			if (!p1.doesOverlap(p2))
			{
				collide = false;
			}
			else if(!mtv || Math.abs(axis.overlap) < Math.abs(mtv.overlap))
			{
				mtv = axis;
			}
		}

		if(!collide)
		{
			return {axes, collide, a, b, mtv};
		}

		const collisionPointsAxis = {...mtv, normal: mtv.normal.clone()};
		if(collisionPointsAxis.poly != b)
		{
			collisionPointsAxis.normal = collisionPointsAxis.normal.neg();
		}

		return {axes, collide, a, b, mtv, ...findCollisionPoints(a, b, collisionPointsAxis)};
	}

	static testSweep(a, b, velA)
	{
		const axes = [...getAxes(a), ...getAxes(b)];

		const velocityAxis = {
			a: a.getPos(), b: a.getPos().add(velA),
			normal: velA.perp().normalize(),
			color: a.getColor(),
			poly: a
		};

		axes.push(velocityAxis);
		
		let collide = true;

		let maxEntry = null;
		let maxAxis = null;
		let flip = false;

		for(const axis of axes)
		{
			const p1 = project(axis.normal, a);
			const p2 = project(axis.normal, b);

			axis.p1 = p1;
			axis.p2 = p2;
			axis.overlap = p1.getOverlap(p2);
			axis.distance = p1.getDistance(p2);

			if (p1.doesOverlap(p2))
			{
				if(maxEntry === null)
				{
					maxEntry = 0;
				}
			}
			else
			{
				const velDot = axis.normal.dot(velA);
				const p3 = new Overlap(Math.min(p1.min, p1.min + velDot), Math.max(p1.max, p1.max + velDot));
				if(p3.doesOverlap(p2) && (velDot >= -axis.distance || velDot <= axis.distance))
				{
					const time = Math.abs(-axis.distance / velDot);
					if(maxEntry === null || time > maxEntry)
					{
						maxEntry = time;
						maxAxis = axis;
						flip = velDot <= axis.distance;
					}
				}
				else 
				{
					collide = false;
				}
			}
		}

		if(maxEntry === null || !collide)
		{
			maxEntry = 1;
		}
		maxEntry = Math.max(Math.min(maxEntry, 1), 0);

		const result = {axes, collide, a, b, time: maxEntry};

		if(collide && maxEntry > 0)
		{
			const mtv = {...maxAxis};
			if(flip)
			{
				mtv.normal = mtv.normal.neg();
			}

			const movedPoly = a.clone();
			movedPoly.setPos(movedPoly.getPos().add(velA.mul(maxEntry * 1.001)));
			Object.assign(result, findCollisionPoints(movedPoly, b, mtv));
		}

		return result;
	}

	static testDoubleSweep(a, b, velA, velB)
	{
		const axes = [...getAxes(a), ...getAxes(b)];
		
		let relativeVel = null;
		if((velA && velA.length() > 0) || (velB && velB.length() > 0))
		{
			if(!velA)
			{
				valA = new Vec();
			}

			if(!velB)
			{
				velB = new Vec();
			}

			relativeVel = velA.sub(velB);

			const velocityAxis = {
				a: a.getPos().add(velA), b: b.getPos().add(velA),
				normal: relativeVel.perp().normalize(),
				color: a.getColor(),
				poly: a
			};

			axes.push(velocityAxis);
		}
		
		let collide = true;

		let maxEntry = null;
		let minExit = null;
		let entryAxis = null;
		let flip = false;

		for(const axis of axes)
		{
			const p1 = project(axis.normal, a);
			const p2 = project(axis.normal, b);

			axis.p1 = p1;
			axis.p2 = p2;

			const velDot = relativeVel ? axis.normal.dot(relativeVel) : 0;

			let entry = 0;
			let exit = 0;

			if(p1.doesOverlap(p2))
			{
				entry = 0; 
			}
			else if(p1.max < p2.min)
			{
				entry = (p1.max - p2.min) / -velDot;
			}
			else
			{
				entry = (p2.max - p1.min) / velDot;
			}

			if(p1.doesOverlap(new Overlap(p2.min - velDot, p2.max, p2.max - velDot)))
			{
				exit = 1;
			}
			else if(p2.max + velDot > p2.max)
			{
				exit = (p1.min - p2.max) / -velDot;
			}
			else
			{
				exit = (p2.min - p1.max) / velDot;
			}

			if(entry < 1 && exit >= 0 && entry < exit)
			{
				if(maxEntry === null || entry > maxEntry)
				{
					maxEntry = entry;
					entryAxis = axis;
					flip = velDot <= 0;
				}

				if((minExit === null || exit < minExit))
				{
					minExit = exit;
				}
			}
			else 
			{
				collide = false;
			}
		}

		if(minExit !== null && (minExit < maxEntry))
		{
			collide = false;
		}

		if(!collide)
		{
			maxEntry = 1;
		}

		const result = {axes, collide, a, b, time: maxEntry};

		if(collide)
		{
			const mtv = {...entryAxis};
			if(flip)
			{
				mtv.normal = mtv.normal.neg();
			}

			const cloneA = a.clone();
			const cloneB = b.clone();

			if(relativeVel)
			{
				cloneA.setPos(cloneA.getPos().add(velA.mul(maxEntry * 1.001)));
				cloneB.setPos(cloneB.getPos().add(velB.mul(maxEntry * 1.001)));
			}

			Object.assign(result, findCollisionPoints(cloneA, cloneB, mtv));
		}

		return result;
	}
}