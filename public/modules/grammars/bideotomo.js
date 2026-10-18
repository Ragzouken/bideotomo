add_grammar("grammars/bideotomo", String.raw`
{{
  function convert(lines) {
    return lines.filter(filter);
  }

  function filter(line) {
    return line && Object.values(line).filter(value => value).length > 0;
  }
}}

{
  // strip end of line comments
  input = input.replace(/\/\/[^\n]*\n/g, "\n");
}

Script
  = __ lines:ScriptLine |.., _ "\n"| __ { return convert(lines); }

ScriptLine
  = ":" _ label:Name { return { label } }
  / "!" _ command:Name _ input:TextLine? { return { command, input: input?.trim() } }
  / "$" _ script:TextLine { return { script } }
  / Choice
  / Dialogue

Dialogue
  = style:Selector |..| text:TextLine? { return { style, text } }

Choice
  = choice:ChoiceLine |1.., _ "\n"| { return { choice } }

ChoiceLine
  = "?" _ label:Name _ text:TextLine { return { label, text } }

Name
  = $[A-Za-z0-9_\-]+

TextLine
  = $[^\n]+

Selector
  = "[" attr:Name "]" { return { attr } }
  / "." cls:Name { return { cls } }
  / "." { return {} }

_ = [ \t]*
__ = [ \t\r\n]*
`);
