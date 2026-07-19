let _count = 0;

export function setAlertCount(n: number) {
  _count = n;
}

export function getAlertCount(): number {
  return _count;
}
