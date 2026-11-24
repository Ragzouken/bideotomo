const _ELEMENT_PARSER = peggy.generate(String.raw`
Root
  = _? @Element _?

Element
  = _? tag:Name? id:("#" @Name)? classes:("." @Name) |..| attributes:Attributes? { return { tag, id, classes, attributes } }

Attributes
  = "[" attributes:Attribute |..,","| "]" { return Object.fromEntries(attributes) } 

Attribute
  = @Name _? "=" _? '"' @$[^"]* '"'

Name
  = $[a-z]+

_ "whitespace"
  = [ \t\n]+
`);

function ELEMENT(query) {
  const data = _ELEMENT_PARSER.parse(query);
  const attrs = data.attributes ?? {};

  if (data.id)
    attrs["id"] = data.id;

  if (data.classes.length > 0)
    attrs["class"] = data.classes.join(" ");

  return html(data.tag, attrs);
}
