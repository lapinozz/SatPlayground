import {useRef, useEffect} from 'react';

export default function useGlobalDOMEvents(props) {
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

			window.addEventListener(key, events[key].domCallback, false);
		}

		return () => {
			for (let [key, event] of Object.entries(events)) {
				window.removeEventListener(key, event.domCallback, false);
			}
		};
	}, []);

	for (let [key, evt] of Object.entries(events))
	{
		evt.currentCallback = props[key];
	}
}