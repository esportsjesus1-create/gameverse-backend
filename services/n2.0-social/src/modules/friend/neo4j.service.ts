import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { SocialProfile } from '../../database/entities/social-profile.entity';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private driver: Driver;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const uri = this.configService.get<string>('neo4j.uri') || 'bolt://localhost:7687';
    const username = this.configService.get<string>('neo4j.username') || 'neo4j';
    const password = this.configService.get<string>('neo4j.password') || 'password';

    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

    await this.initializeSchema();
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver.close();
  }

  private async initializeSchema(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(`
        CREATE CONSTRAINT user_id_unique IF NOT EXISTS
        FOR (u:User) REQUIRE u.id IS UNIQUE
      `);

      await session.run(`
        CREATE INDEX user_username_index IF NOT EXISTS
        FOR (u:User) ON (u.username)
      `);
    } finally {
      await session.close();
    }
  }

  private getSession(): Session {
    return this.driver.session();
  }

  async createUser(profile: SocialProfile): Promise<void> {
    const session = this.getSession();
    try {
      await session.run(
        `
        MERGE (u:User {id: $id})
        SET u.username = $username,
            u.displayName = $displayName,
            u.avatarUrl = $avatarUrl
        `,
        {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        },
      );
    } finally {
      await session.close();
    }
  }

  async createFriendship(userId1: string, userId2: string): Promise<void> {
    const session = this.getSession();
    try {
      await session.run(
        `
        MATCH (u1:User {id: $userId1})
        MATCH (u2:User {id: $userId2})
        MERGE (u1)-[:FRIENDS_WITH]->(u2)
        MERGE (u2)-[:FRIENDS_WITH]->(u1)
        `,
        { userId1, userId2 },
      );
    } finally {
      await session.close();
    }
  }

  async removeFriendship(userId1: string, userId2: string): Promise<void> {
    const session = this.getSession();
    try {
      await session.run(
        `
        MATCH (u1:User {id: $userId1})-[r:FRIENDS_WITH]-(u2:User {id: $userId2})
        DELETE r
        `,
        { userId1, userId2 },
      );
    } finally {
      await session.close();
    }
  }

  async getMutualFriends(userId1: string, userId2: string): Promise<SocialProfile[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u1:User {id: $userId1})-[:FRIENDS_WITH]->(mutual:User)<-[:FRIENDS_WITH]-(u2:User {id: $userId2})
        RETURN mutual
        `,
        { userId1, userId2 },
      );

      return result.records.map((record) => {
        const node = record.get('mutual');
        return {
          id: node.properties.id,
          username: node.properties.username,
          displayName: node.properties.displayName,
          avatarUrl: node.properties.avatarUrl,
        } as SocialProfile;
      });
    } finally {
      await session.close();
    }
  }

  async getFriendsOfFriends(userId: string, limit: number = 20): Promise<SocialProfile[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:FRIENDS_WITH]->(friend:User)-[:FRIENDS_WITH]->(fof:User)
        WHERE fof.id <> $userId
        AND NOT (u)-[:FRIENDS_WITH]->(fof)
        WITH fof, COUNT(friend) as mutualCount
        ORDER BY mutualCount DESC
        LIMIT $limit
        RETURN fof, mutualCount
        `,
        { userId, limit: neo4j.int(limit) },
      );

      return result.records.map((record) => {
        const node = record.get('fof');
        return {
          id: node.properties.id,
          username: node.properties.username,
          displayName: node.properties.displayName,
          avatarUrl: node.properties.avatarUrl,
        } as SocialProfile;
      });
    } finally {
      await session.close();
    }
  }

  async getThirdDegreeFriends(userId: string, limit: number = 20): Promise<SocialProfile[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:FRIENDS_WITH*3]-(third:User)
        WHERE third.id <> $userId
        AND NOT (u)-[:FRIENDS_WITH]->(third)
        AND NOT (u)-[:FRIENDS_WITH]->()-[:FRIENDS_WITH]->(third)
        WITH DISTINCT third
        LIMIT $limit
        RETURN third
        `,
        { userId, limit: neo4j.int(limit) },
      );

      return result.records.map((record) => {
        const node = record.get('third');
        return {
          id: node.properties.id,
          username: node.properties.username,
          displayName: node.properties.displayName,
          avatarUrl: node.properties.avatarUrl,
        } as SocialProfile;
      });
    } finally {
      await session.close();
    }
  }

  async syncFriendGraph(friendships: Array<{ userId1: string; userId2: string }>): Promise<void> {
    const session = this.getSession();
    try {
      for (const { userId1, userId2 } of friendships) {
        await session.run(
          `
          MERGE (u1:User {id: $userId1})
          MERGE (u2:User {id: $userId2})
          MERGE (u1)-[:FRIENDS_WITH]->(u2)
          MERGE (u2)-[:FRIENDS_WITH]->(u1)
          `,
          { userId1, userId2 },
        );
      }
    } finally {
      await session.close();
    }
  }

  async getFriendRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<Array<{ profile: SocialProfile; mutualFriendCount: number }>> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:FRIENDS_WITH]->(friend:User)-[:FRIENDS_WITH]->(recommendation:User)
        WHERE recommendation.id <> $userId
        AND NOT (u)-[:FRIENDS_WITH]->(recommendation)
        WITH recommendation, COUNT(DISTINCT friend) as mutualCount
        ORDER BY mutualCount DESC
        LIMIT $limit
        RETURN recommendation, mutualCount
        `,
        { userId, limit: neo4j.int(limit) },
      );

      return result.records.map((record) => {
        const node = record.get('recommendation');
        const mutualCount = record.get('mutualCount');
        return {
          profile: {
            id: node.properties.id,
            username: node.properties.username,
            displayName: node.properties.displayName,
            avatarUrl: node.properties.avatarUrl,
          } as SocialProfile,
          mutualFriendCount: mutualCount.toNumber(),
        };
      });
    } finally {
      await session.close();
    }
  }
}
