import {useState} from 'react';

function getSavedOptions()
{
	try
	{
		const item = localStorage.getItem('options');
		if(item)
		{
			return JSON.parse(item);
		}
	}
	catch(e)
	{
	}

	return {};
}

function saveOptions(options)
{
	localStorage.setItem('options', JSON.stringify(options));
}

export default function useOptions(defaults = {})
{
	const [options, setOptions] = useState(getSavedOptions());
	saveOptions(options);

	const setOption = (optionId, value) =>
	{
		setOptions({...options, [optionId]: value});
	};

	const getOption = (optionId) =>
	{
		const option = options[optionId];
		if(option === null || option === undefined)
		{
			return defaults[optionId];
		}

		return option;
	};

	const resetOptions = () => setOptions({});

	return {setOption, getOption, resetOptions};
};