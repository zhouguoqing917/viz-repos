export const envVariablesPath = '/services/envs';

export const EnvVariablesServer = Symbol("EnvVariablesServer");
export interface EnvVariablesServer {
    getVariables(): Promise<EnvVariable[]>
    getValue(key: string): Promise<EnvVariable | undefined>
}

export interface EnvVariable {
    readonly name: string
    readonly value: string | undefined
}
