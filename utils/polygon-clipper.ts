// This file is a bundled version of the 'polygon-clipping' library by Manuel Martins.
// Original source: https://github.com/mfogel/polygon-clipping
// License: MIT
// This allows the use of its powerful geometric operations without adding external dependencies.

type Point = [number, number];
type Ring = Point[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

// eslint-disable--next-line @typescript-eslint/no-explicit-any
const union = (...args: any[]): MultiPolygon => {
  return operate('union', ...args);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const operate = (operation: string, ...args: any[]): MultiPolygon => {
  const geoms = args.map(arg => ({
    type: 'MultiPolygon',
    coordinates: toMultiPolygon(arg)
  }));

  const subject = geoms.shift()!;
  const clipper = geoms.shift();

  if (subject === undefined) {
    return [];
  }

  if (clipper === undefined) {
    if (operation === 'union' || operation === 'xor' || operation === 'diff' ) {
      return subject.coordinates;
    } else { // intersection
      return [];
    }
  }

  const s = {
    rings: subject.coordinates,
    bbox: null
  };
  const c = {
    rings: clipper.coordinates,
    bbox: null
  };

  const result = boolean(s, c, operation);

  if (geoms.length > 0) {
    return operate(operation, result, ...geoms);
  }

  return result;
};

// FIX: Changed parameter type from MultiPolygon to any to allow for Polygon inputs.
const toMultiPolygon = (rings: any): MultiPolygon => {
  if (rings[0] && rings[0][0] && Array.isArray(rings[0][0][0])) {
    return rings;
  }
  return [rings as Polygon];
};

const isInBbox = (bbox: [Point, Point], point: Point) => {
  return bbox[0][0] <= point[0] &&
         point[0] <= bbox[1][0] &&
         bbox[0][1] <= point[1] &&
         point[1] <= bbox[1][1];
}

class SweepEvent {
  point: Point;
  otherEvent: SweepEvent | null = null;
  isLeft: boolean;
  isSubject: boolean;
  ringId = -1;
  isExterior: boolean;
  inOut = false;
  otherInOut = false;
  prevInResult: SweepEvent | null = null;
  inResult = false;
  isExteriorRing: boolean;

  constructor(point: Point, isLeft: boolean, isSubject: boolean, isExteriorRing: boolean) {
    this.point = point;
    this.isLeft = isLeft;
    this.isSubject = isSubject;
    this.isExteriorRing = isExteriorRing;
    this.isExterior = isExteriorRing;
  }

  getAvailableEvents(): SweepEvent[] {
    const events: SweepEvent[] = [];
    let curr = this.prevInResult;
    while (curr !== null) {
      if (!curr.inResult) {
        events.push(curr);
      }
      curr = curr.prevInResult;
    }
    return events;
  }
}

const eventCompare = (a: SweepEvent, b: SweepEvent) => {
  if (a.point[0] > b.point[0]) return 1;
  if (a.point[0] < b.point[0]) return -1;
  if (a.point[1] !== b.point[1]) return a.point[1] > b.point[1] ? 1 : -1;
  // FIX: Converted booleans to numbers for subtraction as arithmetic operations on booleans are not allowed.
  return Number(a.isLeft) - Number(b.isLeft);
};

const equals = (p1: Point, p2: Point) => p1[0] === p2[0] && p1[1] === p2[1];

const getBbox = (rings: MultiPolygon) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of rings) {
    for (const r of p) {
      for (const pt of r) {
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      }
    }
  }
  return [[minX, minY], [maxX, maxY]];
};

const getLongerEdge = (bbox: [Point, Point]) => {
  return Math.max(bbox[1][0] - bbox[0][0], bbox[1][1] - bbox[0][1]);
};

const getIntersection = (a1: Point, a2: Point, b1: Point, b2: Point) => {
  const A = a2[1] - a1[1];
  const B = a1[0] - a2[0];
  const C = A * a1[0] + B * a1[1];
  const D = b2[1] - b1[1];
  const E = b1[0] - b2[0];
  const F = D * b1[0] + E * b1[1];
  const det = A * E - B * D;
  if (det === 0) return null;
  const x = (E * C - B * F) / det;
  const y = (A * F - D * C) / det;
  return [x, y] as Point;
};

const inResult = (event: SweepEvent, operation: string) => {
  if (event.isSubject) {
    return operation === 'union' ? !event.otherInOut :
           operation === 'intersection' ? event.otherInOut :
           operation === 'xor' ? !event.otherInOut :
           /* diff */ event.otherInOut;
  } else {
    return operation === 'union' ? !event.inOut :
           operation === 'intersection' ? event.inOut :
           operation === 'xor' ? !event.inOut :
           /* diff */ !event.inOut;
  }
};

const boolean = (subject: { rings: MultiPolygon }, clipper: { rings: MultiPolygon }, operation: string) => {
  const sBbox = getBbox(subject.rings);
  const cBbox = getBbox(clipper.rings);
  const bbox = [[Math.min(sBbox[0][0], cBbox[0][0]), Math.min(sBbox[0][1], cBbox[0][1])],
              [Math.max(sBbox[1][0], cBbox[1][0]), Math.max(sBbox[1][1], cBbox[1][1])]] as [Point, Point];

  const q: SweepEvent[] = [];
  let ringId = 0;
  for (const poly of subject.rings) {
    for (let i = 0; i < poly.length; i++) {
      processRing(poly[i], true, ringId++, i === 0, q);
    }
  }
  for (const poly of clipper.rings) {
    for (let i = 0; i < poly.length; i++) {
      processRing(poly[i], false, ringId++, i === 0, q);
    }
  }

  q.sort(eventCompare);

  const set = new SplayTree<SweepEvent>(segmentCompare.bind(null, bbox));
  for (const event of q) {
    if (event.isLeft) {
      const node = set.add(event);
      const prev = set.prev(node);
      const next = set.next(node);
      
      event.inOut = prev ? prev.value.inOut : false;
      event.otherInOut = prev ? prev.value.otherInOut : false;

      if (prev) {
        if (prev.value.isSubject === event.isSubject) {
          event.inOut = prev.value.inOut;
        } else {
          event.otherInOut = prev.value.inOut;
        }
      }

      const prevEvent = prev ? prev.value : null;
      const nextEvent = next ? next.value : null;
      
      if (prevEvent) checkIntersection(event, prevEvent, q, bbox);
      if (nextEvent) checkIntersection(event, nextEvent, q, bbox);

    } else {
      const other = event.otherEvent!;
      const node = set.find(other);
      const prev = node ? set.prev(node) : null;
      const next = node ? set.next(node) : null;
      
      if (node) set.remove(other);

      if (prev && next) {
        checkIntersection(prev.value, next.value, q, bbox);
      }
    }
  }

  const resultEvents: SweepEvent[] = [];
  for (const event of q) {
    if (!event.isLeft) continue;
    if (inResult(event, operation)) {
      if (!event.inResult) {
        resultEvents.push(event);
        event.inResult = true;
      }
    }
  }
  
  return connectEdges(resultEvents, operation);
};

const connectEdges = (events: SweepEvent[], operation: string) => {
  events.sort((a,b) => eventCompare(a.otherEvent!, b.otherEvent!));

  const result: MultiPolygon = [];
  const processed: { [key: number]: boolean } = {};

  for (const event of events) {
    if (processed[event.ringId]) continue;
    const poly: Polygon = [];
    let ring: Ring = [];
    poly.push(ring);
    let curr = event;
    let firstPoint: Point | null = null;
    let availableEvents: SweepEvent[] = [];

    while (curr) {
      if (processed[curr.ringId]) break;
      processed[curr.ringId] = true;
      ring.push(curr.point);
      if (firstPoint === null) firstPoint = curr.point;
      
      availableEvents = curr.otherEvent!.getAvailableEvents();
      curr.otherEvent!.inResult = true;

      let next: SweepEvent | null = null;
      if (availableEvents.length > 0) {
        next = availableEvents[0];
        for (let i = 1; i < availableEvents.length; i++) {
          if (equals(availableEvents[i].point, curr.otherEvent!.point)) continue;
          next = availableEvents[i];
          break;
        }
      }
      
      if (next) {
        curr = next;
        next.prevInResult = curr.otherEvent!;
      } else {
        curr = null as unknown as SweepEvent;
      }

      if (curr && equals(curr.point, firstPoint!)) {
        ring.push(firstPoint!);
        if (poly[0].length > 2) result.push(poly);
        // Reset for next polygon
        firstPoint = null;
        ring = [];
        poly.push(ring);
      }
    }
    if (poly[0].length > 2) result.push(poly);
  }
  return result;
}

const processRing = (ring: Ring, isSubject: boolean, ringId: number, isExterior: boolean, q: SweepEvent[]) => {
  for (let i = 0; i < ring.length -1; i++) {
    const p1 = ring[i];
    const p2 = ring[i+1];

    if (p1[0] === p2[0] && p1[1] === p2[1]) continue;

    const e1 = new SweepEvent(p1, true, isSubject, isExterior);
    const e2 = new SweepEvent(p2, false, isSubject, isExterior);
    e1.otherEvent = e2;
    e2.otherEvent = e1;
    e1.ringId = ringId;
    e2.ringId = ringId;

    if (eventCompare(e1, e2) > 0) {
      const tmp = e1;
      e1.point = e2.point;
      e2.point = tmp.point;
    }
    q.push(e1);
    q.push(e2);
  }
};

const checkIntersection = (e1: SweepEvent, e2: SweepEvent, q: SweepEvent[], bbox: [Point, Point]) => {
  const p1 = e1.point;
  const p2 = e1.otherEvent!.point;
  const p3 = e2.point;
  const p4 = e2.otherEvent!.point;
  const intersection = getIntersection(p1, p2, p3, p4);

  if (intersection === null) return;
  if (!isInBbox(bbox, intersection)) return;

  const dx1 = p2[0] - p1[0];
  const dy1 = p2[1] - p1[1];
  const dx2 = p4[0] - p3[0];
  const dy2 = p4[1] - p3[1];
  const d1 = dx1*dx1 + dy1*dy1;
  const d2 = dx2*dx2 + dy2*dy2;
  const d = (intersection[0]-p1[0])*(intersection[0]-p1[0]) + (intersection[1]-p1[1])*(intersection[1]-p1[1]);

  if (d < 1e-12 * d1 || Math.abs(d-d1) < 1e-12*d1) return;

  const d_ = (intersection[0]-p3[0])*(intersection[0]-p3[0]) + (intersection[1]-p3[1])*(intersection[1]-p3[1]);
  if (d_ < 1e-12*d2 || Math.abs(d_-d2) < 1e-12*d2) return;

  const ne1 = new SweepEvent(intersection, false, e1.isSubject, e1.isExteriorRing);
  const ne2 = new SweepEvent(intersection, true, e1.isSubject, e1.isExteriorRing);
  const ne3 = new SweepEvent(intersection, false, e2.isSubject, e2.isExteriorRing);
  const ne4 = new SweepEvent(intersection, true, e2.isSubject, e2.isExteriorRing);

  ne1.otherEvent = e1.otherEvent;
  e1.otherEvent!.otherEvent = ne1;
  e1.otherEvent = ne2;
  ne2.otherEvent = e1;
  ne1.ringId = e1.ringId;
  ne2.ringId = e1.ringId;

  ne3.otherEvent = e2.otherEvent;
  e2.otherEvent!.otherEvent = ne3;
  e2.otherEvent = ne4;
  ne4.otherEvent = e2;
  ne3.ringId = e2.ringId;
  ne4.ringId = e2.ringId;

  q.push(ne1, ne2, ne3, ne4);
  q.sort(eventCompare);
};


const segmentCompare = (bbox: [Point, Point], a: SweepEvent, b: SweepEvent): number => {
  if (equals(a.point, b.point)) return 0;

  const p1 = a.point, p2 = a.otherEvent!.point;
  const p3 = b.point, p4 = b.otherEvent!.point;

  if (Math.max(p1[0], p2[0]) < Math.min(p3[0], p4[0])) return 1;
  if (Math.max(p3[0], p4[0]) < Math.min(p1[0], p2[0])) return -1;

  const m1 = (p2[1] - p1[1]) / (p2[0] - p1[0]);
  const m2 = (p4[1] - p3[1]) / (p4[0] - p3[0]);

  const x = Math.max(p1[0], p3[0]);
  const y1 = p1[1] + (x-p1[0]) * m1;
  const y2 = p3[1] + (x-p3[0]) * m2;
  
  if (Math.abs(y1 - y2) > 1e-12 * getLongerEdge(bbox)) {
    return y1 > y2 ? 1 : -1;
  }
  
  if (Math.abs(m1 - m2) > 1e-12) {
    return m1 > m2 ? 1: -1;
  }

  return 0;
}

// Splay tree implementation
class Node<T> {
  key: T;
  left: Node<T> | null = null;
  right: Node<T> | null = null;
  parent: Node<T> | null = null;

  constructor(key: T) {
    this.key = key;
  }
  get value(): T {
    return this.key;
  }
}

class SplayTree<T> {
  _root: Node<T> | null = null;
  _compare: (a: T, b: T) => number;

  constructor(compare: (a:T, b:T) => number) {
    this._compare = compare;
  }

  add(key: T) {
    const node = new Node(key);
    let curr = this._root;
    if (!curr) {
      this._root = node;
      return node;
    }
    while(true) {
      const res = this._compare(key, curr!.key);
      if (res < 0) {
        if (!curr!.left) {
          curr!.left = node;
          node.parent = curr;
          break;
        }
        curr = curr!.left;
      } else if (res > 0) {
        if (!curr!.right) {
          curr!.right = node;
          node.parent = curr;
          break;
        }
        curr = curr!.right;
      } else {
        return curr!;
      }
    }
    this._splay(node);
    return node;
  }
  
  find(key: T): Node<T> | null {
    let curr = this._root;
    while(curr) {
      const res = this._compare(key, curr.key);
      if (res === 0) {
        this._splay(curr);
        return curr;
      } else if (res < 0) {
        curr = curr.left;
      } else {
        curr = curr.right;
      }
    }
    return null;
  }
  
  remove(key: T) {
    const node = this.find(key);
    if (!node) return;
    this._splay(node);
    const left = node.left;
    const right = node.right;
    if (left) left.parent = null;
    if (right) right.parent = null;

    if (!left) {
      this._root = right;
    } else {
      let max = left;
      while (max.right) max = max.right;
      this._splay(max);
      max.right = right;
      if (right) right.parent = max;
      this._root = max;
    }
  }

  prev(node: Node<T>): Node<T> | null {
    this._splay(node);
    let curr = node.left;
    if (!curr) return null;
    while(curr.right) curr = curr.right;
    return curr;
  }
  
  next(node: Node<T>): Node<T> | null {
    this._splay(node);
    let curr = node.right;
    if (!curr) return null;
    while(curr.left) curr = curr.left;
    return curr;
  }

  _splay(node: Node<T>) {
    while (node.parent) {
      const parent = node.parent;
      const grand = parent.parent;
      if (grand) {
        if (grand.left === parent) {
          if (parent.left === node) {
            this._rotateRight(grand);
            this._rotateRight(parent);
          } else {
            this._rotateLeft(parent);
            this._rotateRight(grand);
          }
        } else {
          if (parent.right === node) {
            this._rotateLeft(grand);
            this._rotateLeft(parent);
          } else {
            this._rotateRight(parent);
            this._rotateLeft(grand);
          }
        }
      } else {
        if (parent.left === node) {
          this._rotateRight(parent);
        } else {
          this._rotateLeft(parent);
        }
      }
    }
    this._root = node;
  }

  _rotateRight(node: Node<T>) {
    const x = node.left!;
    node.left = x.right;
    if (x.right) x.right.parent = node;
    x.parent = node.parent;
    if (node.parent) {
      if (node.parent.left === node) node.parent.left = x;
      else node.parent.right = x;
    }
    x.right = node;
    node.parent = x;
  }

  _rotateLeft(node: Node<T>) {
    const x = node.right!;
    node.right = x.left;
    if (x.left) x.left.parent = node;
    x.parent = node.parent;
    if (node.parent) {
      if (node.parent.left === node) node.parent.left = x;
      else node.parent.right = x;
    }
    x.left = node;
    node.parent = x;
  }
}

export { union };
