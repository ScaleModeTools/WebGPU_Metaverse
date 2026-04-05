export type AssertTrue<T extends true> = T;

export type IsAssignable<TFrom, TTo> = [TFrom] extends [TTo] ? true : false;

export type IsEqual<TLeft, TRight> = [TLeft] extends [TRight]
  ? [TRight] extends [TLeft]
    ? true
    : false
  : false;
