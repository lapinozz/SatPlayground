import {useRef} from 'react';

import Vec from './vec';
import useGlobalDOMEvents from './useGlobalDOMEvents';

function getEventPos(e)
{
	return e.touches ? new Vec(e.touches[0].clientX, e.touches[0].clientY) : new Vec(e.clientX, e.clientY); 
}

export default function useDragger({onDragStart, onDrag, onDragEnd, onClick, onDbClick, onZoom} = {})
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

	const handleMouseUp = (e) =>
	{
		dragger.isScaling = false;

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

	const handleMouseMove = (e) =>
	{
		if(dragger.isScaling && e.touches)
		{
			const prevLength = dragger.scaleLength;
			dragger.scaleLength = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
			if(prevLength)
			{
				onZoom(prevLength / dragger.scaleLength);
			}
		}

		if(dragger.isDragging)
		{
			const currentPos = getEventPos(e);
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
		}

		e.preventDefault();
		e.stopPropagation();
		return false;
	};

	const handleMouseDown = (e) =>
	{
	    dragger.isScaling = e.touches && e.touches.length === 2;

	    if(dragger.isScaling && dragger.isDragging)
	    {
			onDragEnd(e, dragger);
	    }

		dragger.isDragging = !dragger.isScaling;
		dragger.hasMoved = false;
		dragger.startPos = getEventPos(e);
		dragger.currentPos = dragger.startPos.clone();
		dragger.lastPos = dragger.currentPos.clone();
		dragger.delta = new Vec();
		dragger.globalDelta = new Vec();
		dragger.target = e.target;
		dragger.scaleLength = null;

		e.preventDefault();
	    e.stopPropagation();
		return false;
	};

	const handleScroll = (e) =>
	{
		onZoom(e, e.deltaY < 0 ? 1.1 : 0.9);
	};

	useGlobalDOMEvents({
		mouseup: handleMouseUp,
		touchend: handleMouseUp,
		mousemove: handleMouseMove,
		touchmove: handleMouseMove,
		wheel: handleScroll
	});

	return {
		dragger,
		handleMouseDown,

	}
};