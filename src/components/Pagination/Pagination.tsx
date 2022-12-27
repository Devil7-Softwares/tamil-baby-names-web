import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

import './Pagination.scss';

interface IProps {
    sizePerPage: number;
    currentPage: number;
    totalCount: number;
    onChange: (currentPage: number) => void;
}

const DOTS = '...';

const range = (start: number, end: number) => {
    let length = end - start + 1;
    return Array.from({ length }, (_, idx) => idx + start);
};

const getPagination = (
    totalCount: number,
    sizePerPage: number,
    currentPage: number
) => {
    const siblingCount = 1;

    const totalPageCount = Math.ceil(totalCount / sizePerPage);

    // Pages count is determined as siblingCount + firstPage + lastPage + currentPage + 2*DOTS
    const totalPageNumbers = siblingCount + 5;

    /*
        If the number of pages is less than the page numbers we want to show in our
        paginationComponent, we return the range [1..totalPageCount]
      */
    if (totalPageNumbers >= totalPageCount) {
        return range(1, totalPageCount);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(
        currentPage + siblingCount,
        totalPageCount
    );

    /*
        We do not want to show dots if there is only one position left 
        after/before the left/right page count as that would lead to a change if our Pagination
        component size which we do not want
      */
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPageCount - 2;

    const firstPageIndex = 1;
    const lastPageIndex = totalPageCount;

    if (!shouldShowLeftDots && shouldShowRightDots) {
        let leftItemCount = 3 + 2 * siblingCount;
        let leftRange = range(1, leftItemCount);

        return [...leftRange, DOTS, totalPageCount];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
        let rightItemCount = 3 + 2 * siblingCount;
        let rightRange = range(
            totalPageCount - rightItemCount + 1,
            totalPageCount
        );
        return [firstPageIndex, DOTS, ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
        let middleRange = range(leftSiblingIndex, rightSiblingIndex);
        return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
    }
};

export const Pagination: React.FC<IProps> = ({
    currentPage,
    sizePerPage,
    totalCount,
    onChange,
}: IProps) => {
    const [pages, setPages] = useState<(string | number)[]>();

    const handleOnChange = (value: number) => {
        gtag('event', 'pagination', {
            currentPage: value,
            totalPage: Math.ceil(totalCount / sizePerPage),
        });

        onChange(value);
    };

    const Page: React.FC<{ value: number }> = ({ value }) => (
        <div
            className={clsx('page', value === currentPage && 'active')}
            onClick={() => handleOnChange(value)}
        >
            {value}
        </div>
    );

    useEffect(() => {
        setPages(getPagination(totalCount, sizePerPage, currentPage));
    }, [totalCount, sizePerPage, currentPage]);

    return (
        <div className='pagination-container'>
            {pages && !!pages.length && (
                <div className='pagination'>
                    <div
                        className={currentPage == 1 ? 'disabled' : ''}
                        onClick={() => {
                            if (currentPage > 1) {
                                handleOnChange(currentPage - 1);
                            }
                        }}
                    >
                        &lt;
                    </div>
                    {pages.map((pageNumber) => {
                        if (pageNumber === DOTS) {
                            return <div className='spacer'>&#8230;</div>;
                        }

                        return <Page value={Number(pageNumber)} />;
                    })}
                    <div
                        className={
                            currentPage === pages[pages.length - 1]
                                ? 'disabled'
                                : ''
                        }
                        onClick={() => {
                            if (currentPage < pages[pages.length - 1]) {
                                handleOnChange(currentPage + 1);
                            }
                        }}
                    >
                        &gt;
                    </div>
                </div>
            )}
        </div>
    );
};
