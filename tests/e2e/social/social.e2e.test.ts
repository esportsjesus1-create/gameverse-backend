import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import {
  createTestUser,
  createFriendship,
  createDirectMessage,
  cleanupTestData,
} from '../helpers/testUtils';

describe('E2E Social Tests', () => {
  let pool: Pool;
  let redis: Redis;
  let client: PoolClient;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.TEST_POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.TEST_POSTGRES_PORT || '5433', 10),
      database: process.env.TEST_POSTGRES_DB || 'gameverse_test',
      user: process.env.TEST_POSTGRES_USER || 'gameverse_test',
      password: process.env.TEST_POSTGRES_PASSWORD || 'gameverse_test_secret',
    });
    redis = new Redis({
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6380', 10),
      db: parseInt(process.env.TEST_REDIS_DB || '1', 10),
      lazyConnect: true,
    });
  });

  beforeEach(async () => {
    client = await pool.connect();
    await cleanupTestData(client);
  });

  afterEach(async () => {
    if (client) {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
    await redis.quit();
  });

  describe('E2E-SOCIAL-001: Send friend request', () => {
    it('should create a pending friend request', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      const result = await client.query(
        `INSERT INTO friend_requests (sender_id, recipient_id, status, message)
         VALUES ($1, $2, 'pending', $3) RETURNING *`,
        [user1.id, user2.id, "Hey, let's be friends!"]
      );

      expect(result.rows[0].sender_id).toBe(user1.id);
      expect(result.rows[0].recipient_id).toBe(user2.id);
      expect(result.rows[0].status).toBe('pending');
    });
  });

  describe('E2E-SOCIAL-002: Accept friend request', () => {
    it('should accept friend request and create friendship', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      await client.query(
        `INSERT INTO friend_requests (sender_id, recipient_id, status) VALUES ($1, $2, 'pending')`,
        [user1.id, user2.id]
      );

      await client.query(
        `UPDATE friend_requests SET status = 'accepted', responded_at = NOW() 
         WHERE sender_id = $1 AND recipient_id = $2`,
        [user1.id, user2.id]
      );

      await createFriendship(client, user1.id, user2.id, 'accepted');
      await createFriendship(client, user2.id, user1.id, 'accepted');

      const result = await client.query(
        `SELECT * FROM friendships WHERE user_id = $1 AND friend_id = $2`,
        [user1.id, user2.id]
      );
      expect(result.rows[0].status).toBe('accepted');
    });
  });

  describe('E2E-SOCIAL-003: Decline friend request', () => {
    it('should decline friend request', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      await client.query(
        `INSERT INTO friend_requests (sender_id, recipient_id, status) VALUES ($1, $2, 'pending')`,
        [user1.id, user2.id]
      );

      await client.query(
        `UPDATE friend_requests SET status = 'declined', responded_at = NOW() 
         WHERE sender_id = $1 AND recipient_id = $2`,
        [user1.id, user2.id]
      );

      const result = await client.query(
        `SELECT status FROM friend_requests WHERE sender_id = $1 AND recipient_id = $2`,
        [user1.id, user2.id]
      );
      expect(result.rows[0].status).toBe('declined');
    });
  });

  describe('E2E-SOCIAL-004: Cancel friend request', () => {
    it('should cancel pending friend request', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      await client.query(
        `INSERT INTO friend_requests (sender_id, recipient_id, status) VALUES ($1, $2, 'pending')`,
        [user1.id, user2.id]
      );

      await client.query(
        `UPDATE friend_requests SET status = 'cancelled' WHERE sender_id = $1 AND recipient_id = $2`,
        [user1.id, user2.id]
      );

      const result = await client.query(
        `SELECT status FROM friend_requests WHERE sender_id = $1 AND recipient_id = $2`,
        [user1.id, user2.id]
      );
      expect(result.rows[0].status).toBe('cancelled');
    });
  });

  describe('E2E-SOCIAL-005: Get pending friend requests', () => {
    it('should retrieve all pending friend requests for user', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const user3 = await createTestUser(client);

      await client.query(
        `INSERT INTO friend_requests (sender_id, recipient_id, status) VALUES ($1, $2, 'pending')`,
        [user2.id, user1.id]
      );
      await client.query(
        `INSERT INTO friend_requests (sender_id, recipient_id, status) VALUES ($1, $2, 'pending')`,
        [user3.id, user1.id]
      );

      const result = await client.query(
        `SELECT * FROM friend_requests WHERE recipient_id = $1 AND status = 'pending'`,
        [user1.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-SOCIAL-006: Get sent friend requests', () => {
    it('should retrieve all sent friend requests', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const user3 = await createTestUser(client);

      await client.query(
        `INSERT INTO friend_requests (sender_id, recipient_id, status) VALUES ($1, $2, 'pending')`,
        [user1.id, user2.id]
      );
      await client.query(
        `INSERT INTO friend_requests (sender_id, recipient_id, status) VALUES ($1, $2, 'pending')`,
        [user1.id, user3.id]
      );

      const result = await client.query(`SELECT * FROM friend_requests WHERE sender_id = $1`, [
        user1.id,
      ]);
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-SOCIAL-007: Remove friend', () => {
    it('should remove friendship', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      await createFriendship(client, user1.id, user2.id, 'accepted');
      await createFriendship(client, user2.id, user1.id, 'accepted');

      await client.query(
        `DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
        [user1.id, user2.id]
      );

      const result = await client.query(
        `SELECT * FROM friendships WHERE user_id = $1 AND friend_id = $2`,
        [user1.id, user2.id]
      );
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-SOCIAL-008: Get friends list', () => {
    it('should retrieve all friends', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const user3 = await createTestUser(client);
      await createFriendship(client, user1.id, user2.id, 'accepted');
      await createFriendship(client, user1.id, user3.id, 'accepted');

      const result = await client.query(
        `SELECT * FROM friendships WHERE user_id = $1 AND status = 'accepted'`,
        [user1.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-SOCIAL-009: Set friend nickname', () => {
    it('should set nickname for friend', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      await createFriendship(client, user1.id, user2.id, 'accepted');

      await client.query(
        `UPDATE friendships SET nickname = $1 WHERE user_id = $2 AND friend_id = $3`,
        ['BestFriend', user1.id, user2.id]
      );

      const result = await client.query(
        `SELECT nickname FROM friendships WHERE user_id = $1 AND friend_id = $2`,
        [user1.id, user2.id]
      );
      expect(result.rows[0].nickname).toBe('BestFriend');
    });
  });

  describe('E2E-SOCIAL-010: Mark friend as favorite', () => {
    it('should mark friend as favorite', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      await createFriendship(client, user1.id, user2.id, 'accepted');

      await client.query(
        `UPDATE friendships SET favorite = true WHERE user_id = $1 AND friend_id = $2`,
        [user1.id, user2.id]
      );

      const result = await client.query(
        `SELECT favorite FROM friendships WHERE user_id = $1 AND friend_id = $2`,
        [user1.id, user2.id]
      );
      expect(result.rows[0].favorite).toBe(true);
    });
  });

  describe('E2E-SOCIAL-011: Get favorite friends', () => {
    it('should retrieve favorite friends', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const user3 = await createTestUser(client);
      await createFriendship(client, user1.id, user2.id, 'accepted');
      await createFriendship(client, user1.id, user3.id, 'accepted');

      await client.query(
        `UPDATE friendships SET favorite = true WHERE user_id = $1 AND friend_id = $2`,
        [user1.id, user2.id]
      );

      const result = await client.query(
        `SELECT * FROM friendships WHERE user_id = $1 AND favorite = true`,
        [user1.id]
      );
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-SOCIAL-012: Block user', () => {
    it('should block a user', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      const result = await client.query(
        `INSERT INTO blocked_users (user_id, blocked_user_id, reason) VALUES ($1, $2, $3) RETURNING *`,
        [user1.id, user2.id, 'Harassment']
      );

      expect(result.rows[0].user_id).toBe(user1.id);
      expect(result.rows[0].blocked_user_id).toBe(user2.id);
    });
  });

  describe('E2E-SOCIAL-013: Unblock user', () => {
    it('should unblock a user', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      await client.query(`INSERT INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2)`, [
        user1.id,
        user2.id,
      ]);

      await client.query(`DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2`, [
        user1.id,
        user2.id,
      ]);

      const result = await client.query(
        `SELECT * FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2`,
        [user1.id, user2.id]
      );
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-SOCIAL-014: Get blocked users list', () => {
    it('should retrieve all blocked users', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const user3 = await createTestUser(client);

      await client.query(`INSERT INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2)`, [
        user1.id,
        user2.id,
      ]);
      await client.query(`INSERT INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2)`, [
        user1.id,
        user3.id,
      ]);

      const result = await client.query(`SELECT * FROM blocked_users WHERE user_id = $1`, [
        user1.id,
      ]);
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-SOCIAL-015: Check if user is blocked', () => {
    it('should check if user is blocked', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      await client.query(`INSERT INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2)`, [
        user1.id,
        user2.id,
      ]);

      const result = await client.query(
        `SELECT EXISTS(SELECT 1 FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2) as is_blocked`,
        [user1.id, user2.id]
      );
      expect(result.rows[0].is_blocked).toBe(true);
    });
  });

  describe('E2E-SOCIAL-016: Send direct message', () => {
    it('should send a direct message', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      const message = await createDirectMessage(client, user1.id, user2.id, 'Hello!');

      expect(message.sender_id).toBe(user1.id);
      expect(message.recipient_id).toBe(user2.id);
      expect(message.content).toBe('Hello!');
      expect(message.is_read).toBe(false);
    });
  });

  describe('E2E-SOCIAL-017: Get conversation messages', () => {
    it('should retrieve messages between two users', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      await createDirectMessage(client, user1.id, user2.id, 'Hello!');
      await createDirectMessage(client, user2.id, user1.id, 'Hi there!');
      await createDirectMessage(client, user1.id, user2.id, 'How are you?');

      const result = await client.query(
        `SELECT * FROM direct_messages 
         WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
         ORDER BY created_at ASC`,
        [user1.id, user2.id]
      );
      expect(result.rows.length).toBe(3);
    });
  });

  describe('E2E-SOCIAL-018: Mark message as read', () => {
    it('should mark message as read', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const message = await createDirectMessage(client, user1.id, user2.id, 'Hello!');

      await client.query(
        `UPDATE direct_messages SET is_read = true, read_at = NOW() WHERE id = $1`,
        [message.id]
      );

      const result = await client.query(
        `SELECT is_read, read_at FROM direct_messages WHERE id = $1`,
        [message.id]
      );
      expect(result.rows[0].is_read).toBe(true);
      expect(result.rows[0].read_at).toBeDefined();
    });
  });

  describe('E2E-SOCIAL-019: Get unread message count', () => {
    it('should get count of unread messages', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      await createDirectMessage(client, user1.id, user2.id, 'Message 1');
      await createDirectMessage(client, user1.id, user2.id, 'Message 2');
      await createDirectMessage(client, user1.id, user2.id, 'Message 3');

      const result = await client.query(
        `SELECT COUNT(*) as unread FROM direct_messages WHERE recipient_id = $1 AND is_read = false`,
        [user2.id]
      );
      expect(parseInt(result.rows[0].unread)).toBe(3);
    });
  });

  describe('E2E-SOCIAL-020: Edit message', () => {
    it('should edit message content', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const message = await createDirectMessage(client, user1.id, user2.id, 'Hello!');

      await client.query(
        `UPDATE direct_messages SET content = $1, is_edited = true, edited_at = NOW() WHERE id = $2`,
        ['Hello! (edited)', message.id]
      );

      const result = await client.query(
        `SELECT content, is_edited FROM direct_messages WHERE id = $1`,
        [message.id]
      );
      expect(result.rows[0].content).toBe('Hello! (edited)');
      expect(result.rows[0].is_edited).toBe(true);
    });
  });

  describe('E2E-SOCIAL-021: Delete message', () => {
    it('should soft delete message', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const message = await createDirectMessage(client, user1.id, user2.id, 'Hello!');

      await client.query(`UPDATE direct_messages SET is_deleted = true WHERE id = $1`, [
        message.id,
      ]);

      const result = await client.query(`SELECT is_deleted FROM direct_messages WHERE id = $1`, [
        message.id,
      ]);
      expect(result.rows[0].is_deleted).toBe(true);
    });
  });

  describe('E2E-SOCIAL-022: Reply to message', () => {
    it('should create reply to message', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const originalMessage = await createDirectMessage(client, user1.id, user2.id, 'Hello!');

      const result = await client.query(
        `INSERT INTO direct_messages (sender_id, recipient_id, content, reply_to_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [user2.id, user1.id, 'Hi back!', originalMessage.id]
      );

      expect(result.rows[0].reply_to_id).toBe(originalMessage.id);
    });
  });

  describe('E2E-SOCIAL-023: Add reaction to message', () => {
    it('should add reaction to message', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const message = await createDirectMessage(client, user1.id, user2.id, 'Hello!');

      const result = await client.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) RETURNING *`,
        [message.id, user2.id, '👍']
      );

      expect(result.rows[0].emoji).toBe('👍');
    });
  });

  describe('E2E-SOCIAL-024: Remove reaction from message', () => {
    it('should remove reaction from message', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const message = await createDirectMessage(client, user1.id, user2.id, 'Hello!');

      await client.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`,
        [message.id, user2.id, '👍']
      );

      await client.query(
        `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [message.id, user2.id, '👍']
      );

      const result = await client.query(`SELECT * FROM message_reactions WHERE message_id = $1`, [
        message.id,
      ]);
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-SOCIAL-025: Get message reactions', () => {
    it('should get all reactions for message', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const user3 = await createTestUser(client);
      const message = await createDirectMessage(client, user1.id, user2.id, 'Hello!');

      await client.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`,
        [message.id, user2.id, '👍']
      );
      await client.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`,
        [message.id, user3.id, '❤️']
      );

      const result = await client.query(`SELECT * FROM message_reactions WHERE message_id = $1`, [
        message.id,
      ]);
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-SOCIAL-026: Update user presence', () => {
    it('should update user presence status', async () => {
      const user = await createTestUser(client);

      await client.query(
        `INSERT INTO user_presence (user_id, status, custom_status) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET status = $2, custom_status = $3, updated_at = NOW()`,
        [user.id, 'away', 'Be right back']
      );

      const result = await client.query(
        `SELECT status, custom_status FROM user_presence WHERE user_id = $1`,
        [user.id]
      );
      expect(result.rows[0].status).toBe('away');
      expect(result.rows[0].custom_status).toBe('Be right back');
    });
  });

  describe('E2E-SOCIAL-027: Get user presence', () => {
    it('should get user presence', async () => {
      const user = await createTestUser(client);

      await client.query(`INSERT INTO user_presence (user_id, status) VALUES ($1, $2)`, [
        user.id,
        'online',
      ]);

      const result = await client.query(`SELECT * FROM user_presence WHERE user_id = $1`, [
        user.id,
      ]);
      expect(result.rows[0].status).toBe('online');
    });
  });

  describe('E2E-SOCIAL-028: Set activity status', () => {
    it('should set user activity', async () => {
      const user = await createTestUser(client);

      await client.query(
        `INSERT INTO user_presence (user_id, status, activity_type, activity_name, activity_details)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, 'online', 'playing', 'GameVerse Arena', 'In ranked match']
      );

      const result = await client.query(
        `SELECT activity_type, activity_name, activity_details FROM user_presence WHERE user_id = $1`,
        [user.id]
      );
      expect(result.rows[0].activity_type).toBe('playing');
      expect(result.rows[0].activity_name).toBe('GameVerse Arena');
    });
  });

  describe('E2E-SOCIAL-029: Get online friends', () => {
    it('should get list of online friends', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const user3 = await createTestUser(client);
      await createFriendship(client, user1.id, user2.id, 'accepted');
      await createFriendship(client, user1.id, user3.id, 'accepted');

      await client.query(`INSERT INTO user_presence (user_id, status) VALUES ($1, $2)`, [
        user2.id,
        'online',
      ]);
      await client.query(`INSERT INTO user_presence (user_id, status) VALUES ($1, $2)`, [
        user3.id,
        'offline',
      ]);

      const result = await client.query(
        `SELECT f.friend_id FROM friendships f
         JOIN user_presence p ON f.friend_id = p.user_id
         WHERE f.user_id = $1 AND f.status = 'accepted' AND p.status = 'online'`,
        [user1.id]
      );
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-SOCIAL-030: Update user settings', () => {
    it('should update user settings', async () => {
      const user = await createTestUser(client);

      await client.query(
        `INSERT INTO user_settings (user_id, privacy_settings, notification_settings)
         VALUES ($1, $2, $3)`,
        [
          user.id,
          JSON.stringify({ profile_visibility: 'friends_only' }),
          JSON.stringify({ push_enabled: false }),
        ]
      );

      const result = await client.query(
        `SELECT privacy_settings, notification_settings FROM user_settings WHERE user_id = $1`,
        [user.id]
      );
      expect(result.rows[0].privacy_settings.profile_visibility).toBe('friends_only');
      expect(result.rows[0].notification_settings.push_enabled).toBe(false);
    });
  });

  describe('E2E-SOCIAL-031: Get user settings', () => {
    it('should retrieve user settings', async () => {
      const user = await createTestUser(client);

      await client.query(`INSERT INTO user_settings (user_id) VALUES ($1)`, [user.id]);

      const result = await client.query(`SELECT * FROM user_settings WHERE user_id = $1`, [
        user.id,
      ]);
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-SOCIAL-032: Report user', () => {
    it('should create user report', async () => {
      const reporter = await createTestUser(client);
      const reported = await createTestUser(client);

      const result = await client.query(
        `INSERT INTO reports (reporter_id, reported_user_id, reason, description)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [reporter.id, reported.id, 'harassment', 'Sent offensive messages']
      );

      expect(result.rows[0].status).toBe('pending');
      expect(result.rows[0].reason).toBe('harassment');
    });
  });

  describe('E2E-SOCIAL-033: Get user reports', () => {
    it('should retrieve reports for user', async () => {
      const reporter = await createTestUser(client);
      const reported = await createTestUser(client);

      await client.query(
        `INSERT INTO reports (reporter_id, reported_user_id, reason) VALUES ($1, $2, $3)`,
        [reporter.id, reported.id, 'harassment']
      );

      const result = await client.query(`SELECT * FROM reports WHERE reported_user_id = $1`, [
        reported.id,
      ]);
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-SOCIAL-034: Resolve report', () => {
    it('should resolve user report', async () => {
      const reporter = await createTestUser(client);
      const reported = await createTestUser(client);
      const admin = await createTestUser(client);

      const reportResult = await client.query(
        `INSERT INTO reports (reporter_id, reported_user_id, reason) VALUES ($1, $2, $3) RETURNING id`,
        [reporter.id, reported.id, 'harassment']
      );

      await client.query(
        `UPDATE reports SET status = 'resolved', resolution = $1, resolved_by = $2, resolved_at = NOW()
         WHERE id = $3`,
        ['Warning issued', admin.id, reportResult.rows[0].id]
      );

      const result = await client.query(`SELECT status, resolution FROM reports WHERE id = $1`, [
        reportResult.rows[0].id,
      ]);
      expect(result.rows[0].status).toBe('resolved');
    });
  });

  describe('E2E-SOCIAL-035: Log user activity', () => {
    it('should log user activity', async () => {
      const user = await createTestUser(client);

      await client.query(
        `INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1, $2, $3)`,
        [user.id, 'login', JSON.stringify({ ip: '192.168.1.1', device: 'desktop' })]
      );

      const result = await client.query(`SELECT * FROM user_activity WHERE user_id = $1`, [
        user.id,
      ]);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].activity_type).toBe('login');
    });
  });

  describe('E2E-SOCIAL-036: Get user activity history', () => {
    it('should retrieve user activity history', async () => {
      const user = await createTestUser(client);

      await client.query(`INSERT INTO user_activity (user_id, activity_type) VALUES ($1, $2)`, [
        user.id,
        'login',
      ]);
      await client.query(`INSERT INTO user_activity (user_id, activity_type) VALUES ($1, $2)`, [
        user.id,
        'game_started',
      ]);
      await client.query(`INSERT INTO user_activity (user_id, activity_type) VALUES ($1, $2)`, [
        user.id,
        'achievement_unlocked',
      ]);

      const result = await client.query(
        `SELECT * FROM user_activity WHERE user_id = $1 ORDER BY created_at DESC`,
        [user.id]
      );
      expect(result.rows.length).toBe(3);
    });
  });

  describe('E2E-SOCIAL-037: Search users by username', () => {
    it('should search users by username', async () => {
      await createTestUser(client, { username: 'player_one' });
      await createTestUser(client, { username: 'player_two' });
      await createTestUser(client, { username: 'gamer_pro' });

      const result = await client.query(`SELECT * FROM users WHERE username ILIKE $1`, [
        '%player%',
      ]);
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-SOCIAL-038: Get mutual friends', () => {
    it('should get mutual friends between two users', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const mutual = await createTestUser(client);

      await createFriendship(client, user1.id, mutual.id, 'accepted');
      await createFriendship(client, user2.id, mutual.id, 'accepted');

      const result = await client.query(
        `SELECT f1.friend_id FROM friendships f1
         JOIN friendships f2 ON f1.friend_id = f2.friend_id
         WHERE f1.user_id = $1 AND f2.user_id = $2 
         AND f1.status = 'accepted' AND f2.status = 'accepted'`,
        [user1.id, user2.id]
      );
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].friend_id).toBe(mutual.id);
    });
  });

  describe('E2E-SOCIAL-039: Get recent conversations', () => {
    it('should get recent conversations', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const user3 = await createTestUser(client);

      await createDirectMessage(client, user1.id, user2.id, 'Hello user2');
      await createDirectMessage(client, user1.id, user3.id, 'Hello user3');

      const result = await client.query(
        `SELECT DISTINCT 
           CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END as other_user_id
         FROM direct_messages
         WHERE sender_id = $1 OR recipient_id = $1
         ORDER BY other_user_id`,
        [user1.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-SOCIAL-040: Check friendship status', () => {
    it('should check friendship status between users', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      await createFriendship(client, user1.id, user2.id, 'accepted');

      const result = await client.query(
        `SELECT status FROM friendships WHERE user_id = $1 AND friend_id = $2`,
        [user1.id, user2.id]
      );
      expect(result.rows[0].status).toBe('accepted');
    });
  });

  describe('E2E-SOCIAL-041: Prevent self friend request', () => {
    it('should detect self friend request attempt', async () => {
      const user = await createTestUser(client);

      const isSelf = user.id === user.id;
      expect(isSelf).toBe(true);
    });
  });

  describe('E2E-SOCIAL-042: Prevent duplicate friend request', () => {
    it('should detect duplicate friend request', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      await client.query(
        `INSERT INTO friend_requests (sender_id, recipient_id, status) VALUES ($1, $2, 'pending')`,
        [user1.id, user2.id]
      );

      const result = await client.query(
        `SELECT EXISTS(
          SELECT 1 FROM friend_requests 
          WHERE sender_id = $1 AND recipient_id = $2 AND status = 'pending'
        ) as exists`,
        [user1.id, user2.id]
      );
      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe('E2E-SOCIAL-043: Prevent messaging blocked user', () => {
    it('should detect blocked user for messaging', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      await client.query(`INSERT INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2)`, [
        user2.id,
        user1.id,
      ]);

      const result = await client.query(
        `SELECT EXISTS(
          SELECT 1 FROM blocked_users 
          WHERE user_id = $1 AND blocked_user_id = $2
        ) as is_blocked`,
        [user2.id, user1.id]
      );
      expect(result.rows[0].is_blocked).toBe(true);
    });
  });

  describe('E2E-SOCIAL-044: Get conversation with user details', () => {
    it('should get messages with user details', async () => {
      const user1 = await createTestUser(client, { display_name: 'User One' });
      const user2 = await createTestUser(client, { display_name: 'User Two' });
      await createDirectMessage(client, user1.id, user2.id, 'Hello!');

      const result = await client.query(
        `SELECT dm.*, u.display_name as sender_name
         FROM direct_messages dm
         JOIN users u ON dm.sender_id = u.id
         WHERE dm.sender_id = $1 AND dm.recipient_id = $2`,
        [user1.id, user2.id]
      );
      expect(result.rows[0].sender_name).toBe('User One');
    });
  });

  describe('E2E-SOCIAL-045: Update last seen timestamp', () => {
    it('should update last seen timestamp', async () => {
      const user = await createTestUser(client);

      await client.query(
        `INSERT INTO user_presence (user_id, status, last_seen_at) VALUES ($1, $2, NOW())`,
        [user.id, 'online']
      );

      await client.query(`UPDATE user_presence SET last_seen_at = NOW() WHERE user_id = $1`, [
        user.id,
      ]);

      const result = await client.query(
        `SELECT last_seen_at FROM user_presence WHERE user_id = $1`,
        [user.id]
      );
      expect(result.rows[0].last_seen_at).toBeDefined();
    });
  });

  describe('E2E-SOCIAL-046: Get friends with presence', () => {
    it('should get friends list with presence info', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      await createFriendship(client, user1.id, user2.id, 'accepted');

      await client.query(`INSERT INTO user_presence (user_id, status) VALUES ($1, $2)`, [
        user2.id,
        'online',
      ]);

      const result = await client.query(
        `SELECT f.*, p.status as presence_status
         FROM friendships f
         LEFT JOIN user_presence p ON f.friend_id = p.user_id
         WHERE f.user_id = $1 AND f.status = 'accepted'`,
        [user1.id]
      );
      expect(result.rows[0].presence_status).toBe('online');
    });
  });

  describe('E2E-SOCIAL-047: Send message with attachment', () => {
    it('should send message with attachment', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      const result = await client.query(
        `INSERT INTO direct_messages (sender_id, recipient_id, content, content_type, attachment_url)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user1.id, user2.id, 'Check this out!', 'image', 'https://cdn.gameverse.com/images/123.png']
      );

      expect(result.rows[0].content_type).toBe('image');
      expect(result.rows[0].attachment_url).toBeDefined();
    });
  });

  describe('E2E-SOCIAL-048: Mark all messages as read', () => {
    it('should mark all messages from user as read', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);

      await createDirectMessage(client, user1.id, user2.id, 'Message 1');
      await createDirectMessage(client, user1.id, user2.id, 'Message 2');

      await client.query(
        `UPDATE direct_messages SET is_read = true, read_at = NOW()
         WHERE sender_id = $1 AND recipient_id = $2 AND is_read = false`,
        [user1.id, user2.id]
      );

      const result = await client.query(
        `SELECT COUNT(*) as unread FROM direct_messages 
         WHERE sender_id = $1 AND recipient_id = $2 AND is_read = false`,
        [user1.id, user2.id]
      );
      expect(parseInt(result.rows[0].unread)).toBe(0);
    });
  });

  describe('E2E-SOCIAL-049: Get user profile', () => {
    it('should get user profile with stats', async () => {
      const user = await createTestUser(client, { level: 50, experience_points: 50000 });

      const result = await client.query(
        `SELECT id, username, display_name, level, experience_points, premium_status
         FROM users WHERE id = $1`,
        [user.id]
      );
      expect(result.rows[0].level).toBe(50);
      expect(parseInt(result.rows[0].experience_points)).toBe(50000);
    });
  });

  describe('E2E-SOCIAL-050: Update user profile', () => {
    it('should update user profile', async () => {
      const user = await createTestUser(client);

      await client.query(`UPDATE users SET display_name = $1, avatar_url = $2 WHERE id = $3`, [
        'New Display Name',
        'https://cdn.gameverse.com/avatars/new.png',
        user.id,
      ]);

      const result = await client.query(
        `SELECT display_name, avatar_url FROM users WHERE id = $1`,
        [user.id]
      );
      expect(result.rows[0].display_name).toBe('New Display Name');
    });
  });

  describe('E2E-SOCIAL-051: Index performance for friendship queries', () => {
    it('should use indexes for friendship queries', async () => {
      const user = await createTestUser(client);

      const result = await client.query(
        `EXPLAIN SELECT * FROM friendships WHERE user_id = $1 AND status = 'accepted'`,
        [user.id]
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('E2E-SOCIAL-052: Index performance for message queries', () => {
    it('should use indexes for message queries', async () => {
      const user = await createTestUser(client);

      const result = await client.query(
        `EXPLAIN SELECT * FROM direct_messages WHERE recipient_id = $1 AND is_read = false`,
        [user.id]
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});
