export interface ParsedCommandBase<Type extends string> {
  type: Type;
  command: string;
  channel?: string;
}

export interface ParsedParams extends ParsedCommandBase<"command"> {
  action: string;
  params?: string;
}
export type ParsedCommand = ParsedCommandBase<"chat"> | ParsedParams;

/**
 *  Parsing the IRC parameters component if it contains a command (e.g., !dice).
 */
export function parseParameters(
  rawParametersComponent: string | null,
  command: ParsedCommand
): ParsedParams | null {
  if (rawParametersComponent) {
    let idx = 0;
    let commandParts = rawParametersComponent.slice(idx + 1).trim();
    let paramsIdx = commandParts.indexOf(" ");
    const parsedParams = { ...command } as ParsedParams;
    if (-1 == paramsIdx) {
      // no parameters
      parsedParams.type = "command";
      parsedParams.action = commandParts.slice(0);
    } else {
      parsedParams.type = "command";
      parsedParams.action = commandParts.slice(0, paramsIdx);
      parsedParams.params = commandParts.slice(paramsIdx).trim();
      // TODO: remove extra spaces in parameters string
    }
    return parsedParams;
  }
  return null;
}
