import {useState} from 'react';

export default function useAny(obj, onChange)
{
	const [instance, setInstance] = useState(() =>
	{
		obj = obj || {};
		if(typeof obj === 'function')
		{
			obj = obj();
		}

		const proxy = new Proxy(obj,
		{
			deleteProperty: function(target, property)
			{
				delete target[property];
				obj.onMutation();
				return true;
			},
			set: function(target, property, value, receiver)
			{
				target[property] = value;
				obj.onMutation();
				return true;
			}
		});

		return {obj, proxy};
	});

	obj = instance.obj;

	if(!obj.onMutation)
	{
		obj.onMutation = () =>
		{
			setInstance({...instance});
			onChange && onChange();
		};
	}

	return instance.proxy;
}