import Vec from './utils/vec';

export default class Polygon 
{
	#points = [];
	#pos =  new Vec();
	#color = '';
	#vel = new Vec();

	constructor()
	{

	}

	static fromData(data)
	{
		const polygon = new Polygon();
		polygon.setPos(new Vec(data.pos));
		polygon.setPoints(data.points.map(point => new Vec(point)));
		polygon.setColor(data.color);
		polygon.setVel(new Vec(data.vel));
		return polygon;
	}

	static toData_mut = false;
	toData()
	{
		return {
			pos: this.getPos(),
			points: this.getPoints(),
			color: this.getColor(),
			vel: this.getVel()
		};
	}

	static clone_mut = false;
	clone()
	{
		return Polygon.fromData(this.toData());
	}

	getPos()
	{
		return this.#pos.clone();
	}

	setPos(pos)
	{
		this.#pos = pos.clone();
	}

	getPoints()
	{
		return this.#points.map(p => p.clone());
	}

	setPoints(points)
	{
		this.#points = points.map(p => p.clone());
	}

	getPoint(idx)
	{
		return this.#points[idx].clone();
	}

	setPoint(idx, pt)
	{
		return this.#points[idx] = pt.clone();
	}

	getAbsolutePoints()
	{
		return this.#points.map(p => p.add(this.#pos));
	}

	static addPoint_mut = true;
	addPoint(pos, index=null)
	{	
		if(index === null)
		{
			index = this.#points.length;
		}

		this.#points.splice(index, 0, pos);
	}

	isConvex()
	{
		const pts = this.#points;
		for(let x = 0; x < pts.length; x++)
		{
			const a = pts[x];
			const b = pts[(x + 1) % pts.length];
			const c = pts[(x + 2) % pts.length];
			const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);

			if(cross < 0)
			{
				return true;
			}
		}

		return false;	
	}

	setColor(color)
	{
		this.#color = color;
	}

	getColor()
	{
		return this.#color;
	}

	setVel(vel)
	{
		this.#vel = vel.clone();
	}

	getVel()
	{
		return this.#vel.clone();
	}
}