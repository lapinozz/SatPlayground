import React from 'react';
import {useState, useRef, useEffect, useCallback} from 'react';
import { createRoot } from 'react-dom/client';

import '../styles/index.scss';

import Vec from './utils/vec';
import useAny from './utils/useAny';
import hookify from './utils/hookify';
import useOptions from './utils/options';
import useDragger from './utils/dragger';
import useGlobalDOMEvents from './utils/useGlobalDOMEvents';

import Polygon from './polygon';
import Sat, {project} from './sat';

const [usePolygon, usePolygons] = hookify(Polygon);

function PolygonView({polygon, i, opacity})
{
	const p = polygon;
	return  <g style={{opacity:opacity || 1}}>
		<polygon type="poly" p={i}
			points={p.getAbsolutePoints().map(point=>point.x+','+point.y).join(' ')}
			style={{fill: p.isConvex() ? 'red' : p.getColor(), strokeWidth:'0'}}>
			</polygon>;

		<g>
		{
			(() => {
				const pts = p.getAbsolutePoints();
				const results = [];
				for(let x = 0; x < pts.length; x++)
				{
					const a = pts[x];
					const b = pts[(x + 1) % pts.length];
					results.push(<line type="poly-line" key={x} x1={a.x} y1={a.y} x2={b.x} y2={b.y} p={i} s={x} e={(x + 1) % pts.length} style={{stroke:"black",strokeWidth:2}} />);
				}
				return results;
			})()
		}
		</g>

		<g>
		{
			p.getAbsolutePoints().map((pt, pi) => 
			{
				return <circle type="poly-point" key={pi} cx={pt.x} cy={pt.y} p={i} i={pi} r="3" stroke="black" strokeWidth="0.75" fill="gray" />
			})
		}
		</g>
	</g>;
}

function PolygonVelView({polygon, i})
{
	const start = polygon.getPos();
	const end = polygon.getPos().add(polygon.getVel());
	return  [
		<LineView
	        id='arrow-line'
	        markerEnd='url(#arrowHead)'
	        strokeWidth='2'
	        fill='none' stroke='black'
	        p1={start}
	        p2={end}
		/>,
  		<path type="poly-vel" p={i} d='M-2,0 L2,4 L2,-4 Z' fill="black" transform={`translate(${end.x} ${end.y}) scale(1.5 1.5) rotate(${polygon.getVel().neg().toAngle()} 0 0)`}/>
  ];
}

function LineView(props)
{
	return <line {...props} x1={props.p1.x} y1={props.p1.y} x2={props.p2.x} y2={props.p2.y} />;
}

const PatternEditor = (props) => {
	const {options, polygons, view} = props; 

	const [hover, setHover] = useState(null);

	const svgRef = useRef(null);

	const dragTarget = useRef(null);
 
	const screenPosToSvgPos = (pos) => {
		const pt = svgRef.current.createSVGPoint();
		pt.x = pos.x;
		pt.y = pos.y;
		return new Vec(pt.matrixTransform(svgRef.current.getScreenCTM().inverse()));
	}

	const eventToSvgPos = (e) => {
		return screenPosToSvgPos({x: e.clientX, y: e.clientY});
	}

	const handleScroll = (e) => {
		let {zoom, center} = view;

		const ratio = e.deltaY < 0 ? 1.1 : 0.9;
		const newZoom = zoom * ratio;

		const mousePos = eventToSvgPos(e);

		center = mousePos.sub(mousePos.sub(center).div(ratio));

		view.zoom = newZoom;
		view.center = center;
	};

	const onDragEnd = (e) => {
		dragTarget.current = null;
	};

	const onDrag = (e, {delta}) => {
		if(dragTarget.current.getAttribute('type') == 'poly-point')
		{
			const polygon = polygons[dragTarget.current.getAttribute('p')];
			const pts = polygon.getPoints();
			const pt = pts[dragTarget.current.getAttribute('i')];
			pts[dragTarget.current.getAttribute('i')] = pt.add(delta.div(view.zoom));
			polygon.setPoints(pts);
		}
		else if(dragTarget.current.getAttribute('type') == 'poly-vel')
		{
			const polygon = polygons[dragTarget.current.getAttribute('p')];
			polygon.setVel(polygon.getVel().add(delta.div(view.zoom)));
		}
		else if(dragTarget.current.getAttribute('type') == 'poly')
		{
			const polygon = polygons[dragTarget.current.getAttribute('p')];
			polygon.setPos(polygon.getPos().add(delta.div(view.zoom)));
		}
		else
		{
			view.center = view.center.sub(delta.div(view.zoom));
		}
	};

	const onDragStart = (e) => {
		dragTarget.current = e.target;
	};

	const onClick = (e, {currentPos}) => {
		//polygons[0].addPoint(screenPosToSvgPos(currentPos));
	};

	const onDbClick = (e, {currentPos}) => {
		const target = e.target;
		if(target.getAttribute('type') == 'poly-line')
		{
			const polygon = polygons[target.getAttribute('p')];
			polygon.addPoint(screenPosToSvgPos(currentPos).sub(polygon.getPos()), parseInt(target.getAttribute('e')));
		}
		else if(target.getAttribute('type') == 'poly-point')
		{
			const polygon = polygons[target.getAttribute('p')];
			const pts = polygon.getPoints();
			if(pts.length <= 3)
			{
				return;
			}

			pts.splice(parseInt(target.getAttribute('i')), 1);
			polygon.setPoints(pts);
		}
	};

	const onMouseMove = (e) =>
	{
		if(e.target != hover)
		{
			setHover(e.target);
		}
	};

	const {dragger, handleMouseDown} = useDragger({onDragStart, onDrag, onDragEnd, onClick, onDbClick});

	useGlobalDOMEvents({
		mousemove: onMouseMove,
	});

	const svgSize = useAny({height: 1, width: 1});
	const ref = useRef(null)

	useEffect(() => {
		svgSize.height = svgRef.current.clientHeight;
		svgSize.width = svgRef.current.clientWidth;
	})

	const viewBoxSize = new Vec(svgSize.width, svgSize.height).div(view.zoom);
	const viewBoxStr = `${view.center.x - viewBoxSize.x / 2} ${view.center.y - viewBoxSize.y / 2} ${viewBoxSize.x} ${viewBoxSize.y}`;

	const collisionType = options.collisionType;

	const velA = collisionType != 'mtv' ? polygons[0].getVel() : null;
	const velB = collisionType == 'doubleSweep' ? polygons[1].getVel() : null;

	const tests = {
		mtv: Sat.test,
		sweep: Sat.testSweep,
		doubleSweep: Sat.testDoubleSweep,
	}

	const collides = tests[collisionType](polygons[0], polygons[1], velA, velB);

	return (
		<svg ref={svgRef} 
			className="svg-view"
			onMouseDown={handleMouseDown} 
			onWheelCapture={handleScroll} 
			viewBox={viewBoxStr} 
				 >
		      <defs>
		        <marker 
		          id='arrowHead' 
		          orient="auto" 
		          markerWidth='3' 
		          markerHeight='4' 
		          refX='0.1' 
		          refY='2'
		        >
		        </marker>
		      </defs>

			{
				collides.collide && collides.mtv && (() =>
				{
					const mtv = collides.mtv;
					const poly = polygons[1].clone();
					poly.setPos(poly.getPos().add(mtv.normal.mul(mtv.overlap)));
					return <PolygonView polygon={poly}/>;
				})()
			}

			{
				collides.time && velA && (() =>
				{
					const poly = polygons[0].clone();
					poly.setPos(poly.getPos().add(poly.getVel().mul(collides.time)));
					return <PolygonView polygon={poly}/>;
				})()
			}

			{
				collides.time && velB && (() =>
				{
					const poly = polygons[1].clone();
					poly.setPos(poly.getPos().add(poly.getVel().mul(collides.time)));
					return <PolygonView polygon={poly}/>;
				})()
			}

			{
				polygons.map((p, i) =>
				{
					return <PolygonView key={i} polygon={p} i={i} opacity={collides.collide ? 0.5 : 1}/>;
				})
			}

			{
				velA && <PolygonVelView polygon={polygons[0]} i={0} />
			}

			{
				velB && <PolygonVelView polygon={polygons[1]} i={1} />
			}

			{
				collides.contacts && collides.contacts.map((c) =>
				{
					return <circle cx={c.x} cy={c.y} r="3" stroke="red" strokeWidth="0.75" fill="gray" />;
				})
			}

			{
				collides.refFace && 
								<line type="axis" x1={collides.refFace.a.x} y1={collides.refFace.a.y} x2={collides.refFace.b.x} y2={collides.refFace.b.y} 
										style={{stroke:"orange",strokeWidth: 2}} />
			}

			{
				collides.incFace && 
								<line type="axis" x1={collides.incFace.a.x} y1={collides.incFace.a.y} x2={collides.incFace.b.x} y2={collides.incFace.b.y} 
										style={{stroke:"purple",strokeWidth: 2}} />
			}

			{
				<g>
				{
					options.showAxes && (() =>
					{
						const results = [];

						collides.axes.map((axis, i) =>
						{
							const center = axis.a.add(axis.b).div(2);
							const perp = axis.normal.perp();
							const projA = project(perp, collides.a);
							const projB = project(perp, collides.b);
							const projMin = Math.min(projA.min, projB.min);
							const origin = perp.mul(projMin - 30);
							const axisOffset = axis.normal.perp().mul(axis.normal.perp().dot(origin));

							const a = origin.add(axis.normal.mul(-1000));
							const b = origin.add(axis.normal.mul(1000));
							const doesOverlap = axis.overlap > 0;

							const isHovered = hover && hover.getAttribute('type') == 'axis' && hover.getAttribute('i') == i;

							results.push(
								<line type="axis" i={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} 
										style={{stroke:collides.mtv==axis?"red":"black",strokeWidth:doesOverlap ? 2 : 1}} />
							);

							if(isHovered)
							{
								results.push(
									<line x1={axis.a.x} y1={axis.a.y} x2={axis.b.x} y2={axis.b.y} 
											style={{stroke:"black",strokeWidth:5}} />
								);

								for(const pt of [collides.a, collides.b].map(poly => poly.getAbsolutePoints().map(p => ({...p, color:poly.getColor()}))).flat())
								{
									const pa = pt;
									const pb = axis.normal.mul(axis.normal.dot(pt)).add(axisOffset);
									results.push(
										<line className='project-line' x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} 
												style={{stroke:pt.color,strokeWidth:1}} strokeDasharray="5,5,5" />
									);
								}

								results.push(
									<LineView p1={axis.normal.mul(axis.p1.min).add(axisOffset)} p2={axis.normal.mul(axis.p1.max).add(axisOffset)} 
									style={{stroke:collides.a.getColor(), strokeWidth: 6}} strokeLinecap="round" strokeOpacity={0.55}/>
								);

								results.push(
									<LineView p1={axis.normal.mul(axis.p2.min).add(axisOffset)} p2={axis.normal.mul(axis.p2.max).add(axisOffset)} 
									style={{stroke:collides.b.getColor(), strokeWidth: 6}} strokeLinecap="round" strokeOpacity={0.55}/>
								);
							}
						})

						return results;
					})()
				}
				</g>
			}
			
		</svg> 
	);
}

function getSavedPolygons()
{
	try
	{
		const polygons = JSON.parse(localStorage.getItem('polygons'));
		return polygons.map(Polygon.fromData);
	}
	catch(e)
	{
	}

	return null;
}

function savePolygons(polygons)
{
	const data = polygons.map(p => p.toData());
	localStorage.setItem('polygons', JSON.stringify(data));

}

function createPolygons(tryLoad = true)
{
	let polygons = tryLoad && getSavedPolygons();
	if(polygons)
	{
		return polygons;
	}

	polygons = [new Polygon(), new Polygon()];

	polygons[0].setColor('orange');
	polygons[0].addPoint(new Vec(-25, -25));
	polygons[0].addPoint(new Vec(25, -10));
	polygons[0].addPoint(new Vec(18, 25));
	polygons[0].addPoint(new Vec(-18, 28));
	polygons[0].setPos(new Vec(25, 25));
	polygons[0].setVel(new Vec(25, -100));

	polygons[1].setColor('blue');
	polygons[1].addPoint(new Vec(-18, 25));
	polygons[1].addPoint(new Vec(25, -25));
	polygons[1].addPoint(new Vec(25, 10));
	polygons[1].setPos(new Vec(-25, -25));
	polygons[1].setVel(new Vec(-25, 100));

	return polygons;
}

const collisionTypes = {
	mtv: "Static",
	sweep: "Sweep",
	doubleSweep: "Double Sweep",
}	

const Header = (props) =>
{	
	const {options, reset} = props;

	const optionDefs = [
		{
			id: 'collisionType',
			name: "Collision Test: ",
			type: 'select',
			list: collisionTypes
		},
		{
			id: 'showAxes',
			name: "Show Axes: ",
			type: 'checkbox',
		},
		{
			id: 'reset',
			name: "Reset",
			type: 'button',
			onClick: reset
		},

	];

	return (
		<nav className="header">
		{
			optionDefs.map((def) =>
			{
				if(def.type == 'button')
				{
					return <input className="option" type="button" value={def.name} onClick={def.onClick}/>
				}
				else if(def.type == 'select')
				{
					return <div className="option">
						<div className="label">{def.name}</div>
						<select value={options.collisionType} onChange={(e) => options.collisionType = e.target.value}>
						{
							Object.keys(collisionTypes).map(k =>
							{
								return <option value={k}>{collisionTypes[k]}</option>
							})
						}
						</select>
					</div>
				}
				else if(def.type == 'checkbox')
				{
					return <div className="option">
						<div className="label">{def.name}</div>
						<input type="checkbox" checked={options.showAxes} onChange={() => options.showAxes = !options.showAxes} />
					</div>
				}
			})
		}
			<a className="repo" id="myLink" href="https://github.com/lapinozz/SatPlayground" target="_blank"><button>Code/Instructions <i className="fa fa-github"></i></button></a>
		</nav>
	);
}

const defaultOptions = {
	collisionType: 'mtv', 
	showAxes: true
};

const defaultView = {zoom: 2, center: new Vec(50, 50)};

const App = () =>
{
	const {options, resetOptions} = useOptions(defaultOptions);

	const polygons = usePolygons(createPolygons);
	savePolygons(polygons);

	const view = useAny(defaultView);

	const reset = () =>
	{
		resetOptions();
		polygons.splice(0, polygons.length, ...createPolygons(false));
		Object.assign(view, defaultView);
	};

	return (
		<div className="container">
			<Header options={options} reset={reset} />
			<PatternEditor polygons={polygons} options={options} view={view}/>
		</div>
	);
}

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);
