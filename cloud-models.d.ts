
import { DataModelMethods } from "@cloudbase/wx-cloud-client-sdk";


interface IModels {
    
}

declare module "@cloudbase/wx-cloud-client-sdk" {
    interface OrmClient extends IModels {}
}

declare global {
    interface WxCloud {
        models: IModels;
    }
}