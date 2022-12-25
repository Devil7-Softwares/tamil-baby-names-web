export interface IResponseData {
    success: boolean;
    message: string;
}

export interface IArrayResponseData<T> extends IResponseData {
    data: T[];
}

export interface IPaginatedResponseData<T> extends IResponseData {
    data: T[];
    total: number;
}
