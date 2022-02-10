
import * as yargs from 'yargs';
import { inject, injectable, named } from 'inversify';
import { ContributionProvider } from '../common/contribution-provider';
import { MaybePromise } from '../common/types';

export const CliContribution = Symbol('CliContribution');

/**
 * Call back for extension to contribute options to the cli.
 */
export interface CliContribution {
    configure(conf: yargs.Argv): void;
    setArguments(args: yargs.Arguments): MaybePromise<void>;
}

@injectable()
export class CliManager {

    constructor(@inject(ContributionProvider) @named(CliContribution)
    protected readonly contributionsProvider: ContributionProvider<CliContribution>) { }

    async initializeCli(argv: string[]): Promise<void> {
        const pack = require('../../package.json');
        const version = pack.version;
        const command = yargs.version(version);
        command.exitProcess(this.isExit());
        for (const contrib of this.contributionsProvider.getContributions()) {
            contrib.configure(command);
        }
        const args = command
            .detectLocale(false)
            .showHelpOnFail(false, 'Specify --help for available options')
            .help('help')
            .parse(argv);
        for (const contrib of this.contributionsProvider.getContributions()) {
            await contrib.setArguments(args);
        }
    }

    protected isExit(): boolean {
        return true;
    }
}
