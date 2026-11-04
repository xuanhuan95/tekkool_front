import {useParams} from 'react-router-dom';

import {SkeletonCard} from '../../components/ui';
import {useBanks} from '../../queries/questionBank';
import BankBlocks from './BankBlocks';
import BankPapers from './BankPapers';

/** `/question-bank/:bankId` — a whole-exam bank lists exams, a block bank lists blocks. A load error falls through to BankBlocks (it shows it). */
export default function BankView() {
    const {bankId = ''} = useParams();
    const {data: banks, isError} = useBanks();
    if (!banks && !isError) return <SkeletonCard/>;
    const bank = banks?.find(b => b.id === bankId);
    return bank?.kind === 'paper' ? <BankPapers bank={bank}/> : <BankBlocks/>;
}
