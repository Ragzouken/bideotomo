add_grammar("grammars/videotome", String.raw`
{{
  function convert(lines) {
    return [
      { label: "start" },
      ...lines.slice(1).filter(filter).flatMap(expand),
      { command: "jump", input: "start" },
    ];
  }

  function filter(line) {
    return line && Object.values(line).filter(value => value).length > 0;
  }
  
  function expand(line) {
  	const lines = [];
    for (const tag of line.tags ?? []) {
      if (tag.startsWith("SFX_"))
      	lines.push({ command: "sound", input: tag });
      else if (tag.startsWith("BG_"))
      	lines.push({ command: "background", input: tag });
      else if (tag.startsWith("MUS_"))
      	lines.push({ command: "music", input: tag });
      else if (tag.endsWith("!"))
      	lines.push({ style: [ { cls: tag.replace("!", "") } ] });
      else if (tag.startsWith("CLEARSCREEN"))
        lines.push({ command: "clear" });
      else
        lines.push({ command: tag });
    }
    if (line.text)
      lines.push({ text: line.text });
    lines.push({ style: [ { cls: "" } ] });
    return lines;
  }
}}

Script
  = __ lines:ScriptLine |.., _ "\n"| __ { return convert(lines); }

ScriptLine
  = tags:(@Tag |.., " "| " - ")? text:TextLine? { return { tags, text } }

Tag
  = $[A-Za-z0-9_!]+

TextLine
  = $[^\n]+

_ = [ \t]*
__ = [ \t\r\n]*
`);
