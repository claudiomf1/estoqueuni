import { GeminiService } from '../gemini/index.js';
import logger from '../../utils/logger.js';

export class QualityChecker {
  constructor() {
    this.gemini = new GeminiService();
    this.metrics = {
      totalQuestions: 0,
      correctAnswers: 0,
      avgConfidence: 0,
      avgResponseTime: 0,
    };
  }

  async checkQuality(question, answer, expectedAnswer = null) {
    const checks = {
      grammar: this.checkGrammar(answer),
      completeness: this.checkCompleteness(answer),
      relevance: this.checkRelevance(question, answer),
      formatting: this.checkFormatting(answer),
    };

    if (expectedAnswer) {
      checks.accuracy = await this.checkAccuracy(answer, expectedAnswer);
    }

    const overallScore = this.calculateOverallScore(checks);

    return {
      passed: overallScore >= 0.7,
      score: overallScore,
      checks,
    };
  }

  checkGrammar(answer) {
    const issues = [];

    // Check for incomplete sentences
    if (!answer.match(/[.!?]$/)) {
      issues.push('Incomplete sentence');
    }

    // Check for excessive repetition
    const words = answer.toLowerCase().split(/\s+/);
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    const maxRepetition = Math.max(...Object.values(wordCount));
    if (maxRepetition > 10 && words.length > 50) {
      issues.push('Excessive word repetition');
    }

    return {
      passed: issues.length === 0,
      issues,
    };
  }

  checkCompleteness(answer) {
    const minLength = 50;
    const maxLength = 5000;
    const length = answer.length;

    return {
      passed: length >= minLength && length <= maxLength,
      length,
      minLength,
      maxLength,
    };
  }

  checkRelevance(question, answer) {
    const questionTerms = question
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 3);

    const answerLower = answer.toLowerCase();
    const matchingTerms = questionTerms.filter(term => 
      answerLower.includes(term)
    ).length;

    const relevanceScore = questionTerms.length > 0 
      ? matchingTerms / questionTerms.length 
      : 0.5;

    return {
      passed: relevanceScore >= 0.3,
      score: relevanceScore,
      matchingTerms,
      totalTerms: questionTerms.length,
    };
  }

  checkFormatting(answer) {
    const hasMarkdown = answer.includes('**') || answer.includes('##') || answer.includes('- ');
    const hasParagraphs = answer.split('\n\n').length > 1;
    const hasStructure = answer.match(/^#{1,3}\s/m) !== null;

    return {
      passed: true,
      hasMarkdown,
      hasParagraphs,
      hasStructure,
    };
  }

  async checkAccuracy(answer, expectedAnswer) {
    try {
      const prompt = `
Compare estas duas respostas e determine o quão similares elas são em termos de conteúdo e precisão.

RESPOSTA GERADA:
${answer}

RESPOSTA ESPERADA:
${expectedAnswer}

Retorne APENAS um JSON:
{
  "similarity": number (0-1),
  "isAccurate": boolean,
  "differences": [lista de principais diferenças]
}
`;

      const result = await this.gemini.model.generateContent(prompt);
      const accuracy = JSON.parse(result.response.text().trim());

      return {
        passed: accuracy.isAccurate,
        similarity: accuracy.similarity,
        differences: accuracy.differences,
      };
    } catch (error) {
      logger.error('Error checking accuracy:', error);
      return { passed: false, error: error.message };
    }
  }

  calculateOverallScore(checks) {
    const weights = {
      grammar: 0.2,
      completeness: 0.2,
      relevance: 0.3,
      formatting: 0.1,
      accuracy: 0.2,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [check, result] of Object.entries(checks)) {
      if (weights[check]) {
        const score = result.passed ? 1 : (result.score || 0);
        totalScore += score * weights[check];
        totalWeight += weights[check];
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0.5;
  }

  updateMetrics(confidence, responseTime) {
    this.metrics.totalQuestions++;
    this.metrics.avgConfidence = (
      (this.metrics.avgConfidence * (this.metrics.totalQuestions - 1) + confidence.score) /
      this.metrics.totalQuestions
    );
    this.metrics.avgResponseTime = (
      (this.metrics.avgResponseTime * (this.metrics.totalQuestions - 1) + responseTime) /
      this.metrics.totalQuestions
    );
  }

  getMetrics() {
    return {
      ...this.metrics,
      accuracy: this.metrics.totalQuestions > 0
        ? (this.metrics.correctAnswers / this.metrics.totalQuestions) * 100
        : 0,
    };
  }
}

