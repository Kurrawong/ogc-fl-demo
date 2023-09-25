
async function resolveContext(...contextDefinitions) {
  const resolvedContext = {};

  // Loop through each context definition
  for (const contextDef of contextDefinitions) {
    if (Array.isArray(contextDef)) {
      // Handle complex context definition that contains both a URL and an inline object
      const [contextUrl, inlineContext] = contextDef;
      if (typeof contextUrl === 'string') {
        const response = await fetch(contextUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch context from ${contextUrl}`);
        }
        const contextObject = await response.json();
        if (inlineContext && typeof inlineContext === 'object') {
          contextObject['@context'] = { ...contextObject['@context'], ...inlineContext };
        }
        Object.assign(resolvedContext, contextObject);
      }
    } else if (typeof contextDef === 'string') {
      // If the context definition is a URL, fetch and merge it
      const contextUrl = contextDef;
      const response = await fetch(contextUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch context from ${contextUrl}`);
      }
      const contextObject = await response.json();
      Object.assign(resolvedContext, contextObject);
    } else if (typeof contextDef === 'object') {
      // If the context definition is an object, merge it
      Object.assign(resolvedContext, contextDef);
    }
  }

  return resolvedContext;
}


function flattenValue(value) {
  if (typeof value === 'object' && value !== null && '@value' in value) {
    return value['@value'];
  }
  if (Array.isArray(value)) {
    if (value.length === 1 && typeof value[0] === 'object' && '@value' in value[0]) {
      return value[0]['@value'];
    }
    return value.map(flattenValue);
  }
  if (typeof value === 'object' && value !== null) {
    const result = {};
    for (const key in value) {
      result[key] = flattenValue(value[key]);
    }
    return result;
  }
  return value;
}

function flattenExpandedJsonLd(expanded) {
  const flattened = expanded.map(item => {
    const properties = {};
    for (const key in item) {
      const value = item[key];
      if (Array.isArray(value)) {
        properties[key] = value.map(flattenValue);
      } else {
        properties[key] = flattenValue(value);
      }
    }
    return properties;
  });
  return flattened.length === 1 ? flattened[0] : flattened;
}

async function expandProperties(featureNum, feature, context, log) {

  let name = 'name' in feature.properties ? ' (' + feature.properties['name'] + ')' : '';
  name = name == '' ? ('id' in feature.properties ? feature.properties['id'] : '') : name;
  name = name == '' ? ('iri' in feature.properties ? feature.properties['iri'] : '') : name;
  name = name == '' ? featureNum : name;

  const idx = `Feature "${name}"`;

  console.log("CONTEXT = ", context)

  const resolvedContext = await resolveContext(context);

  log['Resolved Context'] = resolvedContext;

  const ldExpanded = await jsonld.expand({...feature.properties}, {expandContext: resolvedContext });
  log[idx + ': JSON-LD expanded'] = ldExpanded;
  const flat = flattenExpandedJsonLd(ldExpanded);
  log[idx + ': Flatterned values'] = flat;
}

async function init(fileParam) {

  const urlParams = new URLSearchParams(window.location.search);
  // const fileParam = urlParams.get('file');
  const response = await fetch(fileParam); 
  let data = await response.json();
  const log = {};
  log['Original'] = data;


  if(data['@context']) {
    const context = data['@context'];
    log['Context'] = context;
//    const context = await (await fetch(data['@context'])).json();
//    log['Context loaded'] = context;
    // manual process of features...
    if(data.type == 'Feature') {
        data = {type: 'FeatureCollection', features: [data]};
    }
    if(data.type == 'FeatureCollection' && data.features) {
        for(index in data.features) {
          const feature = data.features[index];
          await expandProperties(index + 1, feature, context, log);
        }
    }
  } else {
    log['No context'] = 'No @context found';
  }
  console.log("LOG", log)
  setTimeout(()=>{
    document.getElementById('results').innerHTML = '<div>' + 
      Object.keys(log).map(key=>{
        return `<h4>${key}</h4><pre style="max-height:400px;overflow-y:scroll;">${JSON.stringify(log[key], undefined, '  ')}</pre>`;
      }).join('') + '</div>';
  })
}

