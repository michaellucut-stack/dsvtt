/** Operator connecting terms in a dice expression. */
export type Operator = '+' | '-';

/**
 * Keep/drop modifier for selecting a subset of rolled dice.
 * - `kh`: Keep highest N
 * - `kl`: Keep lowest N
 * - `dh`: Drop highest N
 * - `dl`: Drop lowest N
 */
export type KeepDropMode = 'kh' | 'kl' | 'dh' | 'dl';

/** Modifier applied to a dice group after rolling. */
export interface DiceModifier {
  /** The type of keep/drop modifier. */
  mode: KeepDropMode;
  /** How many dice to keep or drop. */
  count: number;
}

/** A single dice group (e.g., "2d6", "4d8kh3"). */
export interface DiceGroup {
  type: 'dice';
  /** Number of dice to roll. */
  count: number;
  /** Number of sides per die. */
  sides: number;
  /** Optional keep/drop modifier. */
  modifier: DiceModifier | null;
  /** Whether dice explode (re-roll on max). */
  exploding: boolean;
}

/** A constant numeric term (e.g., "+3"). */
export interface ConstantTerm {
  type: 'constant';
  value: number;
}

/** A single term in the expression — either a dice group or a constant. */
export type ExpressionTerm = DiceGroup | ConstantTerm;

/** A node in the expression tree connecting terms with operators. */
export interface ExpressionNode {
  term: ExpressionTerm;
  operator: Operator;
}

/**
 * A parsed dice expression AST.
 * Represented as a head term followed by zero or more operator+term pairs.
 */
export interface DiceExpression {
  /** The first term in the expression. */
  head: ExpressionTerm;
  /** Subsequent operator+term pairs (e.g., "+3", "-1d4"). */
  rest: ExpressionNode[];
}

/** Result of rolling a single die. */
export interface SingleDieResult {
  /** Number of faces on the die. */
  sides: number;
  /** The rolled value. */
  result: number;
  /** Whether this die was dropped by a keep/drop modifier. */
  dropped: boolean;
  /** Whether this die exploded (rolled max, triggered re-roll). */
  exploded: boolean;
}

/** Result of evaluating a single dice group. */
export interface DiceGroupResult {
  type: 'dice';
  /** The original dice group definition. */
  group: DiceGroup;
  /** Individual die outcomes. */
  rolls: SingleDieResult[];
  /** Subtotal for this group (excluding dropped dice). */
  subtotal: number;
}

/** Result of evaluating a constant term. */
export interface ConstantResult {
  type: 'constant';
  value: number;
}

/** Result of evaluating a single expression term. */
export type TermResult = DiceGroupResult | ConstantResult;

/** Result of evaluating a complete dice expression. */
export interface DiceResult {
  /** The original formula string. */
  formula: string;
  /** The parsed expression that was evaluated. */
  expression: DiceExpression;
  /** Results for each term in order. */
  terms: { operator: Operator; result: TermResult }[];
  /** All individual die rolls flattened across all groups. */
  rolls: SingleDieResult[];
  /** The final computed total. */
  total: number;
}
