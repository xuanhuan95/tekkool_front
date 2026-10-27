/*
 * Design D "Sổ tay" component kit (SPT-54). Import from here:
 *   import {Button, Card, QuestionBlock} from '../components/ui';
 * Styles load with this module; tokens live in src/styles/tokens.css (--vt-*).
 * Live catalogue (dev only): /dev/ui.
 */
import './ui.css';
import './layout/layout.css';
import './exam/exam.css';

export {default as Button, buttonClass} from './Button';
export type {ButtonProps, ButtonVariant, ButtonSize} from './Button';
export {default as Card, CardTitle, PageTitle} from './Card';
export {default as Badge, StatusBadge, FilterChip, STATUS_BADGE} from './Badge';
export {default as TitleChip, TITLE_TONE} from './TitleChip';
export type {TitleTier} from './TitleChip';
export type {BadgeTone, Status} from './Badge';
export {default as StatPill} from './StatPill';
export {TextField, TextArea, Select, PasswordField, DateField, parseDmy, isoToDmy, maskDmy} from './Field';
export {default as Switch} from './Switch';
export {Tabs, SegmentedControl} from './Tabs';
export {default as Table} from './Table';
export type {Column} from './Table';
export {default as Modal, ConfirmDialog} from './Modal';
export {default as IconButton} from './IconButton';
export type {IconButtonProps} from './IconButton';
export {ToastCard, notify} from './toast';
export {EmptyState, ErrorState, Skeleton, SkeletonCard} from './States';
export {default as ProgressBar} from './ProgressBar';
export {default as Avatar, Medal, initialsOf} from './Avatar';
export {default as WaveLine} from './WaveLine';
export * as icons from './icons';
export {cx} from './cx';

export {default as HeaderSticky, StudentStats} from './layout/Header';
export {default as BottomNav} from './layout/BottomNav';
export {StudentLayout, WebLayout, AdminLayout, TeacherLayout, PageColumns} from './layout/Layouts';
export {STUDENT_NAV_MOBILE, STUDENT_NAV_WEB, ADMIN_NAV, TEACHER_NAV} from './layout/nav';
export type {NavItem} from './layout/nav';

export {default as QuestionBlock} from './exam/QuestionBlock';
export type {QuestionBlockProps, ChoiceOption, TrueFalseStatement, EssayTool} from './exam/QuestionBlock';
export {QuestionNumberStrip, QuestionGrid} from './exam/QuestionNav';
export type {QuestionGridPart} from './exam/QuestionNav';
export {ExamHeader, ExamSection, ExamEnd, ExamLayout, AutosaveNote, ExamBanner} from './exam/ExamFrame';
export {countTrueFalse, countWords, formatClock, questionCellLabel, WARN_SECONDS} from './exam/types';
export type {QuestionStatus, TrueFalseValue} from './exam/types';
