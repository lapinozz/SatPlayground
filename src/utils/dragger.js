import {useRef} from 'react';

import Vec from './vec';
import useGlobalDOMEvents from './useGlobalDOMEvents';

export default function useDragger({onDragStart, onDrag, onDragEnd, onClick, onDbClick, onMove} = {})
{
	const dragger = useRef({});

	const handleClick = (e) =>
	{
		const clearCount = () =>
		{
			dragger.clickCount = 0;
		}

		dragger.clickCount = (dragger.clickCount || 0) + 1;
		if (dragger.clickCount === 1)
		{
			onClick(e, dragger);
			dragger.clickTimer = setTimeout(clearCount, 300);
		}
		else if (dragger.clickCount === 2)
		{
			clearTimeout(dragger.clickTimer);
			clearCount();
			onDbClick(e, dragger);
		}
	};

	const handleMouseUp = (e) => {
		if(!dragger.isDragging)
		{
			return;
		}
		
		dragger.isDragging = false;
		
		if(dragger.hasMoved)
		{
			onDragEnd(e, dragger)
		}
		else
		{
			handleClick(e);
		}
	};

	const handleMouseMove = (e) => {
		if(!dragger.isDragging)
		{
			return;
		}

		const currentPos = new Vec(e.clientX, e.clientY);
		const globalDelta = currentPos.sub(dragger.startPos);

		if(!dragger.hasMoved && globalDelta.length() > 2)
		{
			dragger.hasMoved = true;
			onDragStart(e, dragger);
		}

		if(dragger.hasMoved)
		{
			dragger.lastPos = dragger.currentPos;
			dragger.currentPos = currentPos;
			dragger.delta = currentPos.sub(dragger.lastPos);
			dragger.globalDelta = globalDelta;

			onDrag(e, dragger);
		}
	};

	const handleMouseDown = (e) => {
		dragger.isDragging = true;
		dragger.hasMoved = false;
		dragger.startPos = new Vec(e.clientX, e.clientY);
		dragger.currentPos = dragger.startPos.clone();
		dragger.lastPos = dragger.currentPos.clone();
		dragger.delta = new Vec();
		dragger.globalDelta = new Vec();
	};

	useGlobalDOMEvents({
		mouseup: handleMouseUp,
		mousemove: handleMouseMove,
	});

	return {
		dragger,
		handleMouseDown,
	}
};