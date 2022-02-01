
import type {
    Object
} from "@pinglue/utils";

export type FindQuery = {

    one?: boolean;
    noTotalCount?: boolean;

    filters?: Record<string, any>;
    projection?: {
        [fieldName: string]: 1 | -1;
    };
    sort?: {
        [fieldName: string]: 1 | -1;
    };
    limit?: number;
    skip?: number;
};

export type PaginationInfo = {
    currentPage?: number;
    pageCount?: number;
    pageSize?: number;
};

export type FindQueryParams = {

    collection: string;
    query?: FindQuery;
    paginationInfo?: PaginationInfo;
    group?: string;

};

export type FindQueryResponse = {

    // db result
    result: Object | Object[];

    totalCount?: number;

};
