import Challenge from '../models/Challenge';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import Notification from '../models/Notification';

/**
 * Auto-settlement job
 * Runs periodically to settle completed challenges after dispute window expires
 * Should be called every minute via cron job or scheduler
 */
export const autoSettleChallenges = async () => {
  try {
    const now = new Date();
    console.log(`[Auto-Settlement] Running at ${now.toISOString()}`);

    // Find all completed challenges where dispute deadline has passed
    const challengesToSettle = await Challenge.find({
      status: 'COMPLETED',
      isDisputed: false,
      isFlagged: false,
      disputeDeadline: { $lte: now, $ne: null }
    }).populate('creator acceptor witness');

    console.log(`[Auto-Settlement] Found ${challengesToSettle.length} challenges to settle`);
    
    if (challengesToSettle.length > 0) {
      console.log('[Auto-Settlement] Challenge IDs:', challengesToSettle.map(c => c._id));
    }

    for (const challenge of challengesToSettle) {
      try {
        await settleSingleChallenge(challenge);
      } catch (error) {
        console.error(`[Auto-Settlement] Error settling challenge ${challenge._id}:`, error);
        // Continue with next challenge even if one fails
      }
    }

    console.log(`[Auto-Settlement] Completed settlement run`);
  } catch (error) {
    console.error('[Auto-Settlement] Error in auto-settlement job:', error);
  }
};

/**
 * Settle a single challenge
 * Handles fund disbursement and notifications
 */
async function settleSingleChallenge(challenge: any) {
  console.log(`[Auto-Settlement] Settling challenge ${challenge._id}`);
  console.log(`[Auto-Settlement] Challenge details - Status: ${challenge.status}, Dispute Deadline: ${challenge.disputeDeadline}, Winner: ${challenge.winner}`);

  // Determine payout recipients
  const winnerId = challenge.winner;
  const witnessId = challenge.witness?._id || challenge.witness;

  if (!winnerId) {
    // Draw - refund both players
    console.log(`[Auto-Settlement] Challenge ${challenge._id} is a draw - refunding both players`);
    
    // Refund creator
    await Wallet.findOneAndUpdate(
      { userId: challenge.creator },
      { $inc: { balance: challenge.stakeAmount } }
    );

    await Transaction.create({
      userId: challenge.creator,
      type: 'CREDIT',
      amount: challenge.stakeAmount,
      description: `Refund for draw in challenge vs ${challenge.acceptorUsername}`,
      status: 'COMPLETED',
      category: 'CHALLENGE_REFUND',
      metadata: {
        challengeId: challenge._id,
        reason: 'Draw'
      }
    });

    // Refund acceptor
    if (challenge.acceptor) {
      await Wallet.findOneAndUpdate(
        { userId: challenge.acceptor },
        { $inc: { balance: challenge.stakeAmount } }
      );

      await Transaction.create({
        userId: challenge.acceptor,
        type: 'CREDIT',
        amount: challenge.stakeAmount,
        description: `Refund for draw in challenge vs ${challenge.creatorUsername}`,
        status: 'COMPLETED',
        category: 'CHALLENGE_REFUND',
        metadata: {
          challengeId: challenge._id,
          reason: 'Draw'
        }
      });
    }

    // Notify both players
    await Notification.create({
      userId: challenge.creator,
      type: 'CHALLENGE',
      title: 'Challenge Settled - Draw',
      message: `Your stake of ₦${challenge.stakeAmount.toLocaleString()} has been refunded.`,
      data: { challengeId: challenge._id }
    });

    if (challenge.acceptor) {
      await Notification.create({
        userId: challenge.acceptor,
        type: 'CHALLENGE',
        title: 'Challenge Settled - Draw',
        message: `Your stake of ₦${challenge.stakeAmount.toLocaleString()} has been refunded.`,
        data: { challengeId: challenge._id }
      });
    }

  } else {
    // Winner exists - pay winner and witness
    console.log(`[Auto-Settlement] Challenge ${challenge._id} - Winner: ${challenge.winnerUsername}`);

    // Pay winner
    await Wallet.findOneAndUpdate(
      { userId: winnerId },
      { $inc: { balance: challenge.winnerPayout } }
    );

    await Transaction.create({
      userId: winnerId,
      type: 'CREDIT',
      amount: challenge.winnerPayout,
      description: `Won challenge vs ${challenge.loserUsername}`,
      status: 'COMPLETED',
      category: 'CHALLENGE_WIN',
      metadata: {
        challengeId: challenge._id,
        score: `${challenge.finalScore.creator}-${challenge.finalScore.acceptor}`
      }
    });

    // Pay witness
    if (witnessId) {
      const witnessFee = challenge.totalPot * challenge.witnessFee;
      
      await Wallet.findOneAndUpdate(
        { userId: witnessId },
        { $inc: { balance: witnessFee } }
      );

      await Transaction.create({
        userId: witnessId,
        type: 'CREDIT',
        amount: witnessFee,
        description: `Witness fee for ${challenge.creatorUsername} vs ${challenge.acceptorUsername}`,
        status: 'COMPLETED',
        category: 'WITNESS_FEE',
        metadata: {
          challengeId: challenge._id,
          score: `${challenge.finalScore.creator}-${challenge.finalScore.acceptor}`
        }
      });

      // Notify witness
      await Notification.create({
        userId: witnessId,
        type: 'CHALLENGE',
        title: 'Witness Fee Received',
        message: `You earned ₦${witnessFee.toLocaleString()} for witnessing this match.`,
        data: { challengeId: challenge._id }
      });
    }

    // Notify winner
    await Notification.create({
      userId: winnerId,
      type: 'CHALLENGE',
      title: 'Challenge Settled - You Won!',
      message: `Congratulations! You won ₦${challenge.winnerPayout.toLocaleString()}.`,
      data: { challengeId: challenge._id }
    });

    // Notify loser
    if (challenge.loser) {
      await Notification.create({
        userId: challenge.loser,
        type: 'CHALLENGE',
        title: 'Challenge Settled',
        message: `Match settled. Better luck next time!`,
        data: { challengeId: challenge._id }
      });
    }
  }

  // Update challenge status to SETTLED
  challenge.status = 'SETTLED';
  challenge.settledAt = new Date();
  await challenge.save();

  console.log(`[Auto-Settlement] Successfully settled challenge ${challenge._id}`);
}

/**
 * Initialize the auto-settlement scheduler
 * Runs every minute to check for challenges ready to settle
 */
export const startAutoSettlementScheduler = () => {
  console.log('[Auto-Settlement] Starting auto-settlement scheduler...');
  
  // Run immediately on startup
  autoSettleChallenges();
  
  // Then run every minute
  setInterval(autoSettleChallenges, 60 * 1000); // 60 seconds
  
  console.log('[Auto-Settlement] Scheduler started - running every 60 seconds');
};
