import {useState} from 'react';

export default function hookify(Class, mutableTable = {})
{
	const functions = {};

	for(const funcName of Object.getOwnPropertyNames(Class.prototype))
	{
		if(funcName == 'constructor')
		{
			continue;
		}

		const func = Class.prototype[funcName];
		if(typeof func != 'function')
		{
			continue;
		}

		let isMutating = undefined;

		isMutating = func.mutating;

		if(isMutating === undefined)
		{
			isMutating = mutableTable[funcName];
		}

		if(isMutating === undefined)
		{
			isMutating = Class[funcName + '_mut'];
		}

		if(isMutating === undefined)
		{
			if(funcName.startsWith('get') || funcName.startsWith('is'))
			{
				isMutating = false;
			}
			else if(funcName.startsWith('set'))
			{
				isMutating = true;
			}
		}

		if(isMutating === undefined)
		{
			console.error(`Could not determine if function "${funcName} is mutating`);

			isMutating = true;
		}

		functions[funcName] = function (...args) {
			const result = func.apply(this.instance, args);

			if(isMutating)
			{
				this.onMutation();
			}

			return result;
		};
	}

	const createInstanceHolderObj = (instance, Class) =>
	{
		instance = instance || new Class();
		if(typeof instance === 'function')
		{
			instance = instance();
		}

		return {instance};
	}

	const createInstanceHolderArray = (instance, Class, hookifyFunc) =>
	{
		instance = instance || [];
		if(typeof instance === 'function')
		{
			instance = instance();
		}

		instance = instance.map(i => hookifyFunc(i, () => instance.onMutation()));

		instance.proxy = new Proxy(instance,
		{
			deleteProperty: function(target, property)
			{
				delete target[property];
				instance.onMutation();
				return true;
			},
			set: function(target, property, value, receiver)
			{
				console.log('set', target, property, value)
				if(property != 'length')
				{
					value = hookifyFunc(value, instance.onMutation);
				}
				target[property] = value;
				instance.onMutation();
				return true;
			}
		});

		return {instance};
	}

	const hookifyObj = (instance, onMutation) =>
	{
		if(Array.isArray(instance))
		{
			return hookifyArray(instance);
		}
		else
		{
			if(!onMutation)
			{
				const [instanceHolder, setInstanceHolder] = useState(() => createInstanceHolderObj(instance, Class));
				instance = instanceHolder.instance;
				onMutation = () => setInstanceHolder({instance});
			}
			else
			{
				instance = createInstanceHolderObj(instance, Class).instance;
			}

			return {...functions, instance, onMutation};
		}
	};

	const hookifyArray = (instance) =>
	{
		const [instanceHolder, setInstanceHolder] = useState(() => createInstanceHolderArray(instance, Class, hookifyObj));
		instance = instanceHolder.instance;
		instance.onMutation = () => setInstanceHolder({instance});

		return instance.proxy;
	};

	return [hookifyObj, hookifyArray];
};