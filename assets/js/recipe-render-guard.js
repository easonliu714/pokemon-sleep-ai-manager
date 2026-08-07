// Compatibility module retained for historical imports.
// v0.3.95.2 assigns recipeTable exclusively to public-catalog-workbench.
// Shared knowledge renders into personalRecipeAnalysisTable/referenceRecipeTable.

function announce(){
  globalThis.dispatchEvent?.(new CustomEvent('pokemon-sleep:recipe-render-guard-ready',{detail:{
    mutation_observer:false,
    recipe_table_authority:'public-catalog-workbench.js',
    analysis_table_authority:'shared-knowledge-ui.js',
  }}));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',announce,{once:true});else announce();
