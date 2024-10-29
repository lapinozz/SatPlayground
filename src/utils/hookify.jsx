import {useState} from 'react';

const hookify = (Class, mutableTable = {}) => {
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
			const instance = this.instanceHolder.instance;
			const result = func.apply(instance, args);

			if(isMutating)
			{
				this.setInstanceHolder({instance});
			}

			return result;
		};
	}

	return (instance) => {
		let [instanceHolder, setInstanceHolder] = useState({instance: instance || new Class()});

		return {...functions, instanceHolder, setInstanceHolder};
	};
};

export default hookify;