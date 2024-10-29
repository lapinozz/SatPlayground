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

		console.error("Bad case in getOverlap!");
		return 0;
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

export function project(axis, polygon)
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

function clip(n, c, pts)
{
  let sp = 0;
  let out = [pts[0], pts[1]];

  // Retrieve distances from each endpoint to the line
  // d = ax + by - c
  const d1 = n.dot(pts[0]) - c;
  const d2 = n.dot(pts[1]) - c;

  // If negative (behind plane) clip
  if(d1 <= 0) out[sp++] = pts[0];
  if(d2 <= 0) out[sp++] = pts[1];
  
  // If the points are on different sides of the plane
  if(d1 * d2 < 0) // less than to ignore -0.0f
  {
    // Push interesection point
    const alpha = d1 / (d1 - d2);
    out[sp] = pts[0].add(pts[1].sub(pts[0]).mul(alpha));
    ++sp;
  }

  // Assign our new converted values
  pts.splice(0, 10, ...out);
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

function findCollisionPoints(a, b, mtv)
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

		mtv = {...mtv, normal: mtv.normal.clone()};
		mtv.overlap = Math.abs(mtv.overlap);
		if(mtv.poly != b)
		{
			mtv.normal = mtv.normal.neg();
		}

		const {contacts, refFace, incFace} = findCollisionPoints(a, b, mtv);

		return {axes, collide, a, b, mtv, contacts, refFace, incFace};
	}
}