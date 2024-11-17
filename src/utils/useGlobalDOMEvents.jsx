import {useRef, useEffect} from 'react';

export default function useGlobalDOMEvents(props, options = { capture: false, passive: false }) {
	const eventsRef = useRef({});
	const events = eventsRef.current;

	useEffect(() => {
		for (let [key, func] of Object.entries(props))
		{
			events[key] = {
				currentCallback: func,
				domCallback: (e) =>
				{
					events[key].currentCallback(e);
				}
			};

			window.addEventListener(key, events[key].domCallback, options);
		}

		return () => {
			for (let [key, event] of Object.entries(events)) {
				window.removeEventListener(key, event.domCallback, options);
			}
		};
	}, []);

	for (let [key, evt] of Object.entries(events))
	{
		evt.currentCallback = props[key];
	}
}