import { ClaudeService } from './services/ClaudeService'
import { GeminiService } from './services/GeminiService'
import { PerplexityService } from './services/PerplexityService'
import { ExtractionService } from './services/ExtractionService'
import { ScraperRegistry } from './scrapers/ScraperRegistry'
import { CompetitorService } from './services/CompetitorService'
import { AdsService } from './services/AdsService'
import { AdsController } from './controllers/AdsController'
import { AnalysisController } from './controllers/AnalysisController'
import { CompetitorsController } from './controllers/CompetitorsController'

// Leaves (no dependencies)
const llmAnalyser = new ClaudeService()                  // swap for any ILLMAnalyser impl
const videoConverterService = new GeminiService()        // swap for any IVideoAnalyser impl
const webSearchProvider = new PerplexityService()        // swap for any IWebSearchProvider impl
const scraperRegistry = new ScraperRegistry()

// Branches
const extractionService = new ExtractionService(llmAnalyser)
const competitorService = new CompetitorService(webSearchProvider, llmAnalyser)
const adsService = new AdsService(scraperRegistry, extractionService)

// Controllers
export const adsController = new AdsController(adsService)
export const analysisController = new AnalysisController(llmAnalyser, videoConverterService)
export const competitorsController = new CompetitorsController(competitorService)
