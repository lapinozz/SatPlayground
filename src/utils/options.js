import useAny from './useAny';

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

function initOptions(defaults)
{
	const savedOptions = getSavedOptions();
	return Object.assign({}, defaults, saveOptions);
}

export default function useOptions(defaults = {})
{
	const options = useAny(() => getSavedOptions(defaults), () => saveOptions(options));

	const resetOptions = () => Object.assign(options, defaults);

	return {options, resetOptions};
};