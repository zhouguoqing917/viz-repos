import { inject, injectable } from 'inversify';
import { QuickCommandService } from './quick-command-service';
import { Command, CommandContribution, CommandRegistry } from '../../common';
import { KeybindingContribution, KeybindingRegistry } from "../keybinding";

export const quickCommand: Command = {
    id: 'quickCommand',
    label: 'Open Quick Command'
};

@injectable()
export class QuickCommandFrontendContribution implements CommandContribution, KeybindingContribution {

    @inject(QuickCommandService)
    protected readonly quickCommandService: QuickCommandService;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(quickCommand, {
            execute: () => this.quickCommandService.open()
        });
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: quickCommand.id,
            keybinding: "f1"
        });
        keybindings.registerKeybinding({
            command: quickCommand.id,
            keybinding: "ctrlcmd+shift+p"
        });
    }

}